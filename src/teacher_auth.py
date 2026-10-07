import hashlib
import hmac
import json
import secrets
from pathlib import Path
from typing import Any

PASSWORD_ITERATIONS = 600_000


def create_password_record(password: str) -> dict[str, str | int]:
    salt = secrets.token_bytes(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS
    )
    return {
        "algorithm": "pbkdf2_sha256",
        "iterations": PASSWORD_ITERATIONS,
        "salt": salt.hex(),
        "password_hash": password_hash.hex(),
    }


def verify_password(password: str, record: Any) -> bool:
    if not isinstance(record, dict) or record.get("algorithm") != "pbkdf2_sha256":
        return False
    try:
        salt = bytes.fromhex(record["salt"])
        expected_hash = record["password_hash"]
    except (KeyError, TypeError, ValueError):
        return False
    if not isinstance(expected_hash, str):
        return False

    password_hash = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS
    ).hex()
    return hmac.compare_digest(password_hash, expected_hash)


def load_teacher_credentials(credentials_file: Path) -> dict[str, Any]:
    try:
        credentials = json.loads(credentials_file.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    if not isinstance(credentials, dict):
        raise ValueError("Teacher credentials must be a JSON object")
    return credentials


def save_teacher_credentials(credentials_file: Path, credentials: dict[str, Any]) -> None:
    temporary_file = credentials_file.with_suffix(".json.tmp")
    temporary_file.write_text(
        json.dumps(credentials, indent=2) + "\n", encoding="utf-8"
    )
    temporary_file.chmod(0o600)
    temporary_file.replace(credentials_file)