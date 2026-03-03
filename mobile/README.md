# Final Project

Plant care platform with three parts:

- Backend API: Django + Django REST Framework + Celery
- Web frontend: React + Vite
- Mobile app: Expo React Native (`mobile/mobile-app`)

## Project Structure

- `backend/backend/` - Django project (`manage.py`, `config`, `core`)
- `frontend/` - React web app
- `mobile/mobile-app/` - Main Expo mobile app

## Prerequisites

Install these first:

- Python 3.11+
- Node.js 18+
- npm
- Android Studio + Android Emulator (for mobile simulator)
- (Optional) Redis, if you want to run Celery workers locally

## 1) Run the Backend (Django)

From the workspace root:

```bash
cd Final_Project/backend/backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Backend URL:

- `http://127.0.0.1:8000`

### Optional: Run Celery

If Redis is running on `127.0.0.1:6379`:

```bash
cd Final_Project/backend/backend
.venv\Scripts\activate
celery -A config worker -l info
```

## 2) Run the Web Frontend (React)

In a new terminal:

```bash
cd Final_Project/frontend
npm install
npm run dev
```

Vite will print the local web URL (usually `http://localhost:5173`).

## 3) Run the Mobile App (Expo)

In a new terminal:

```bash
cd Final_Project/mobile/mobile-app
npm install
npx expo start --android --clear
```

Notes:

- Use `--clear` if you see an old cached app.
- Press `a` in Expo terminal to reopen on Android emulator.

## Environment Variables

Backend reads environment variables for external services, including:

- `PERENUAL_API_KEY`
- `TREFLE_API_TOKEN`
- `GEMINI_API_KEY`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`

Create a `.env` file in `backend/backend/` when needed.

## Quick Start (Minimal)

If you only want the mobile app against local backend:

1. Start backend (`python manage.py runserver 0.0.0.0:8000`)
2. Start mobile app (`npx expo start --android --clear`)
3. Open Android emulator / Expo Go
