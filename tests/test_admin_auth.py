import asyncio
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.parse import unquote, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import app as activities_app
from teacher_auth import create_password_record


async def asgi_request(method, path, body=b"", headers=None):
    parsed_path = urlsplit(path)
    request_headers = list(headers or [])
    if body:
        request_headers.append((b"content-type", b"application/json"))
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": unquote(parsed_path.path),
        "raw_path": parsed_path.path.encode("ascii"),
        "query_string": parsed_path.query.encode("ascii"),
        "root_path": "",
        "headers": request_headers,
        "client": ("testclient", 12345),
        "server": ("testserver", 80),
        "state": {},
    }
    messages = []
    request_sent = False

    async def receive():
        nonlocal request_sent
        if not request_sent:
            request_sent = True
            return {"type": "http.request", "body": body, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message):
        messages.append(message)

    await activities_app.app(scope, receive, send)
    response_headers = dict(messages[0].get("headers", []))
    response_body = b"".join(
        message.get("body", b"")
        for message in messages
        if message["type"] == "http.response.body"
    )
    return messages[0]["status"], response_headers, response_body


class AdminAuthTests(unittest.TestCase):
    def setUp(self):
        self.original_activities = copy.deepcopy(activities_app.activities)
        self.original_credentials_file = activities_app.TEACHER_CREDENTIALS_FILE
        self.original_sessions = activities_app.teacher_sessions.copy()
        self.temp_directory = tempfile.TemporaryDirectory()
        activities_app.TEACHER_CREDENTIALS_FILE = Path(self.temp_directory.name) / "teachers.json"
        activities_app.TEACHER_CREDENTIALS_FILE.write_text(
            json.dumps({"teacher": create_password_record("school-password-123")}),
            encoding="utf-8",
        )
        activities_app.teacher_sessions.clear()

    def tearDown(self):
        activities_app.activities.clear()
        activities_app.activities.update(self.original_activities)
        activities_app.TEACHER_CREDENTIALS_FILE = self.original_credentials_file
        activities_app.teacher_sessions.clear()
        activities_app.teacher_sessions.update(self.original_sessions)
        self.temp_directory.cleanup()

    def request(self, method, path, body=b"", headers=None):
        return asyncio.run(asgi_request(method, path, body, headers))

    def test_activity_list_remains_public_and_shows_participants(self):
        status, _, body = self.request("GET", "/activities")
        activities = json.loads(body)

        self.assertEqual(status, 200)
        self.assertIn("michael@mergington.edu", activities["Chess Club"]["participants"])

    def test_activity_changes_require_teacher_login(self):
        status, _, _ = self.request(
            "POST", "/activities/Chess%20Club/signup?email=new%40mergington.edu"
        )
        self.assertEqual(status, 401)

        status, _, _ = self.request(
            "DELETE", "/activities/Chess%20Club/unregister?email=michael%40mergington.edu"
        )
        self.assertEqual(status, 401)
        self.assertIn("michael@mergington.edu", activities_app.activities["Chess Club"]["participants"])

    def test_teacher_can_login_register_logout_and_is_blocked_after_logout(self):
        status, response_headers, body = self.request(
            "POST",
            "/auth/login",
            json.dumps({"username": "teacher", "password": "school-password-123"}).encode(),
        )
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(body)["authenticated"])
        cookie = response_headers[b"set-cookie"].split(b";", 1)[0]
        auth_headers = [(b"cookie", cookie)]

        status, _, _ = self.request(
            "POST", "/activities/Chess%20Club/signup?email=new%40mergington.edu", headers=auth_headers
        )
        self.assertEqual(status, 200)
        self.assertIn("new@mergington.edu", activities_app.activities["Chess Club"]["participants"])

        status, _, _ = self.request("DELETE", "/auth/session", headers=auth_headers)
        self.assertEqual(status, 200)
        status, _, _ = self.request(
            "POST", "/activities/Chess%20Club/signup?email=another%40mergington.edu", headers=auth_headers
        )
        self.assertEqual(status, 401)

    def test_invalid_password_is_rejected(self):
        status, response_headers, _ = self.request(
            "POST",
            "/auth/login",
            json.dumps({"username": "teacher", "password": "incorrect-password"}).encode(),
        )
        self.assertEqual(status, 401)
        self.assertNotIn(b"set-cookie", response_headers)


if __name__ == "__main__":
    unittest.main()