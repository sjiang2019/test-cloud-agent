# cloud-agent

A full-stack application with a FastAPI backend and React TypeScript frontend.

## Backend

Python FastAPI app managed with Poetry.

```bash
cd backend
poetry install
poetry run uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`.

## Frontend

TypeScript React app bootstrapped with Create React App.

```bash
cd frontend
npm install
npm start
```

The dev server runs at `http://localhost:3000` and proxies API requests to `localhost:8000`.
