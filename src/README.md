# Mergington High School Activities API

A super simple FastAPI application that allows students to view and sign up for extracurricular activities.

## Features

- View all available extracurricular activities
- View registered participants
- Allow authenticated teachers to register and unregister students

## Getting Started

1. Install the dependencies:

   ```
   pip install fastapi uvicorn
   ```

2. Run the application:

   ```
   python app.py
   ```

3. Open your browser and go to:
   - API documentation: http://localhost:8000/docs
   - Alternative documentation: http://localhost:8000/redoc

4. Create a teacher login from the repository root. The password is prompted
   securely and stored as a salted PBKDF2 hash in the ignored `src/teachers.json`:

   ```
   python src/create_teacher.py teacher-username
   ```

   Teacher sessions are held in memory and expire after eight hours. For an
   HTTPS deployment, set `COOKIE_SECURE=true` so the session cookie is only
   sent over secure connections. Students can view activities and participants
   without signing in; only authenticated teachers can change registrations.

## API Endpoints

| Method | Endpoint                                                          | Description                                                         |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| GET    | `/activities`                                                     | Get all activities with their details and current participant count |
| POST   | `/auth/login`                                                      | Start a teacher session                                             |
| GET    | `/auth/session`                                                    | Check whether a teacher is signed in                                |
| DELETE | `/auth/session`                                                    | End the current teacher session                                     |
| POST   | `/activities/{activity_name}/signup?email=student@mergington.edu` | Sign up a student (teachers only)                                   |
| DELETE | `/activities/{activity_name}/unregister?email=student@mergington.edu` | Unregister a student (teachers only)                              |

## Data Model

The application uses a simple data model with meaningful identifiers:

1. **Activities** - Uses activity name as identifier:

   - Description
   - Schedule
   - Maximum number of participants allowed
   - List of student emails who are signed up

2. **Students** - Uses email as identifier:
   - Name
   - Grade level

All data is stored in memory, which means data will be reset when the server restarts.
