# Expense Tracker — Minimal Full-stack

This repo implements a small expense tracker (backend API + simple frontend) to satisfy the assignment requirements.

Quick points
- Backend: Flask + SQLite (file `expenses.db`).
- Frontend: static HTML/JS under `static/` served by Flask.
- POST `/expenses` supports an optional client `id` to make requests idempotent (server returns existing record if id already exists).

Why SQLite: simple, zero-config persistent store suitable for a small single-user app and easy to run locally. It keeps the implementation minimal while being robust enough to show persistence across restarts.

How to run (Windows)
1. Create a virtualenv and install:

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
python app.py
```

2. Open http://localhost:5000

Design notes
- Money handling: amounts are parsed using `Decimal` and stored as integer cents in the DB to avoid floating point errors.
- Idempotency: client supplies an `id` (the frontend generates a `crypto.randomUUID()`); the server uses it as the primary key and returns the existing row if insertion conflicts — this handles retries, duplicate clicks, and page refreshes after submitting.
- API filters: GET `/expenses?category=Food&sort=date_desc` supports category filtering and newest-first sorting.

Things intentionally omitted or short due to timebox
- Authentication and multi-user separation.
- Comprehensive tests — a couple of small tests would be straightforward to add.
- Advanced UI/UX polishing.
