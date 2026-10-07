import argparse
import getpass
from pathlib import Path

from teacher_auth import create_password_record, load_teacher_credentials, save_teacher_credentials


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a teacher login for the activities app")
    parser.add_argument("username", help="Teacher username")
    username = parser.parse_args().username.strip()
    if not username:
        parser.error("username cannot be empty")

    password = getpass.getpass("Teacher password (minimum 12 characters): ")
    confirmation = getpass.getpass("Confirm password: ")
    if len(password) < 12:
        parser.error("password must be at least 12 characters")
    if password != confirmation:
        parser.error("passwords do not match")

    credentials_file = Path(__file__).with_name("teachers.json")
    credentials = load_teacher_credentials(credentials_file)
    if username in credentials:
        parser.error("that teacher username already exists")

    credentials[username] = create_password_record(password)
    save_teacher_credentials(credentials_file, credentials)
    print(f"Created teacher login for {username}.")


if __name__ == "__main__":
    main()