from __future__ import annotations

import json
import os
import random
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from contextlib import asynccontextmanager

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
EXCALIDRAW_DIR = os.path.join(DATA_DIR, "excalidraw")
DB_PATH = os.path.join(DATA_DIR, "app.db")

os.makedirs(EXCALIDRAW_DIR, exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Simple Task Draw API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS objectives (
                id TEXT PRIMARY KEY,
                path TEXT UNIQUE NOT NULL,
                prompt TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS submissions (
                id TEXT PRIMARY KEY,
                objective_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                duration_ms INTEGER NOT NULL,
                rating_clarity INTEGER NOT NULL,
                rating_accuracy INTEGER NOT NULL,
                rating_confidence INTEGER NOT NULL,
                rating_speed INTEGER NOT NULL,
                notes TEXT,
                excalidraw_path TEXT,
                FOREIGN KEY (objective_id) REFERENCES objectives(id)
            )
            """
        )
        conn.commit()


class ObjectiveCreate(BaseModel):
    path: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)
    status: str = "active"


class ObjectiveUpdate(BaseModel):
    path: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)
    status: str = Field(..., min_length=1)


class ObjectiveOut(BaseModel):
    id: str
    path: str
    prompt: str
    status: str
    created_at: str
    updated_at: str


class SubmissionCreate(BaseModel):
    duration_ms: int = Field(..., ge=0)
    rating_clarity: int = Field(..., ge=1, le=5)
    rating_accuracy: int = Field(..., ge=1, le=5)
    rating_confidence: int = Field(..., ge=1, le=5)
    rating_speed: int = Field(..., ge=1, le=5)
    notes: str | None = None
    excalidraw_data: dict[str, Any]


class SubmissionOut(BaseModel):
    id: str
    objective_id: str
    created_at: str
    duration_ms: int
    rating_clarity: int
    rating_accuracy: int
    rating_confidence: int
    rating_speed: int
    notes: str | None


class ProgressSummary(BaseModel):
    objective_id: str
    total_submissions: int
    total_duration_ms: int
    avg_rating: float
    last_submitted_at: str | None
    current_streak_days: int
    best_streak_days: int
    heatmap: list[dict[str, Any]]


class TelemetryOverview(BaseModel):
    total_submissions: int
    total_objectives: int
    avg_rating: float
    total_duration_ms: int
    recent_submissions: list[dict[str, Any]]
    random_objective: ObjectiveOut | None
    heatmap: list[dict[str, Any]]


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/objectives", response_model=list[ObjectiveOut])
def list_objectives() -> list[ObjectiveOut]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, path, prompt, status, created_at, updated_at FROM objectives ORDER BY path"
        ).fetchall()
    return [ObjectiveOut(**dict(row)) for row in rows]


@app.get("/api/objectives/by-path", response_model=ObjectiveOut)
def get_objective_by_path(path: str) -> ObjectiveOut:
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, path, prompt, status, created_at, updated_at FROM objectives WHERE path = ?",
            (path,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Objective not found")
    return ObjectiveOut(**dict(row))


@app.post("/api/objectives", response_model=ObjectiveOut)
def create_objective(payload: ObjectiveCreate) -> ObjectiveOut:
    objective_id = str(uuid.uuid4())
    now = utc_now_iso()
    with get_db() as conn:
        try:
            conn.execute(
                """
                INSERT INTO objectives (id, path, prompt, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (objective_id, payload.path, payload.prompt, payload.status, now, now),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=400, detail="Objective path already exists")
    return ObjectiveOut(
        id=objective_id,
        path=payload.path,
        prompt=payload.prompt,
        status=payload.status,
        created_at=now,
        updated_at=now,
    )


@app.put("/api/objectives/{objective_id}", response_model=ObjectiveOut)
def update_objective(objective_id: str, payload: ObjectiveUpdate) -> ObjectiveOut:
    now = utc_now_iso()
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM objectives WHERE id = ?",
            (objective_id,),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Objective not found")
        try:
            conn.execute(
                """
                UPDATE objectives
                SET path = ?, prompt = ?, status = ?, updated_at = ?
                WHERE id = ?
                """,
                (payload.path, payload.prompt, payload.status, now, objective_id),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=400, detail="Objective path already exists")

        row = conn.execute(
            "SELECT id, path, prompt, status, created_at, updated_at FROM objectives WHERE id = ?",
            (objective_id,),
        ).fetchone()
    return ObjectiveOut(**dict(row))


@app.get("/api/objectives/{objective_id}/submissions", response_model=list[SubmissionOut])
def list_submissions(objective_id: str) -> list[SubmissionOut]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, objective_id, created_at, duration_ms,
                   rating_clarity, rating_accuracy, rating_confidence, rating_speed, notes
            FROM submissions
            WHERE objective_id = ?
            ORDER BY created_at DESC
            """,
            (objective_id,),
        ).fetchall()
    return [SubmissionOut(**dict(row)) for row in rows]


@app.post("/api/objectives/{objective_id}/submissions", response_model=SubmissionOut)
def create_submission(objective_id: str, payload: SubmissionCreate) -> SubmissionOut:
    submission_id = str(uuid.uuid4())
    now = utc_now_iso()
    excalidraw_path = os.path.join(EXCALIDRAW_DIR, f"{submission_id}.json")
    with open(excalidraw_path, "w", encoding="utf-8") as f:
        json.dump(payload.excalidraw_data, f)

    with get_db() as conn:
        objective = conn.execute(
            "SELECT id FROM objectives WHERE id = ?",
            (objective_id,),
        ).fetchone()
        if not objective:
            raise HTTPException(status_code=404, detail="Objective not found")

        conn.execute(
            """
            INSERT INTO submissions (
                id, objective_id, created_at, duration_ms,
                rating_clarity, rating_accuracy, rating_confidence, rating_speed,
                notes, excalidraw_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                submission_id,
                objective_id,
                now,
                payload.duration_ms,
                payload.rating_clarity,
                payload.rating_accuracy,
                payload.rating_confidence,
                payload.rating_speed,
                payload.notes,
                excalidraw_path,
            ),
        )
        conn.commit()

    return SubmissionOut(
        id=submission_id,
        objective_id=objective_id,
        created_at=now,
        duration_ms=payload.duration_ms,
        rating_clarity=payload.rating_clarity,
        rating_accuracy=payload.rating_accuracy,
        rating_confidence=payload.rating_confidence,
        rating_speed=payload.rating_speed,
        notes=payload.notes,
    )


@app.get("/api/submissions/{submission_id}/excalidraw")
def get_submission_excalidraw(submission_id: str) -> dict[str, Any]:
    with get_db() as conn:
        row = conn.execute(
            "SELECT excalidraw_path FROM submissions WHERE id = ?",
            (submission_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Submission not found")
    excalidraw_path = row["excalidraw_path"]
    if not excalidraw_path or not os.path.exists(excalidraw_path):
        raise HTTPException(status_code=404, detail="Drawing data not found")
    with open(excalidraw_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _calculate_streaks(dates: list[str]) -> tuple[int, int]:
    if not dates:
        return 0, 0
    unique_dates = sorted({d.split("T")[0] for d in dates})
    best = 1
    current = 1
    for i in range(1, len(unique_dates)):
        prev_date = datetime.fromisoformat(unique_dates[i - 1])
        curr_date = datetime.fromisoformat(unique_dates[i])
        delta_days = (curr_date - prev_date).days
        if delta_days == 1:
            current += 1
        else:
            best = max(best, current)
            current = 1
    best = max(best, current)
    return current, best


def _build_heatmap(dates: list[str]) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for ts in dates:
        date_only = ts.split("T")[0]
        counts[date_only] = counts.get(date_only, 0) + 1
    return [{"date": date, "count": count} for date, count in sorted(counts.items())]


@app.get("/api/objectives/{objective_id}/progress", response_model=ProgressSummary)
def get_progress(objective_id: str) -> ProgressSummary:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT created_at, duration_ms, rating_clarity, rating_accuracy,
                   rating_confidence, rating_speed
            FROM submissions
            WHERE objective_id = ?
            ORDER BY created_at ASC
            """,
            (objective_id,),
        ).fetchall()
    if not rows:
        return ProgressSummary(
            objective_id=objective_id,
            total_submissions=0,
            total_duration_ms=0,
            avg_rating=0.0,
            last_submitted_at=None,
            current_streak_days=0,
            best_streak_days=0,
            heatmap=[],
        )

    total_duration = sum(row["duration_ms"] for row in rows)
    ratings = [
        (row["rating_clarity"] + row["rating_accuracy"] + row["rating_confidence"] + row["rating_speed"]) / 4
        for row in rows
    ]
    avg_rating = sum(ratings) / len(ratings) if ratings else 0.0
    dates = [row["created_at"] for row in rows]
    current_streak, best_streak = _calculate_streaks(dates)
    heatmap = _build_heatmap(dates)

    return ProgressSummary(
        objective_id=objective_id,
        total_submissions=len(rows),
        total_duration_ms=total_duration,
        avg_rating=round(avg_rating, 2),
        last_submitted_at=dates[-1] if dates else None,
        current_streak_days=current_streak,
        best_streak_days=best_streak,
        heatmap=heatmap,
    )


@app.get("/api/telemetry/overview", response_model=TelemetryOverview)
def telemetry_overview() -> TelemetryOverview:
    with get_db() as conn:
        total_submissions_row = conn.execute("SELECT COUNT(*) as count FROM submissions").fetchone()
        total_objectives_row = conn.execute("SELECT COUNT(*) as count FROM objectives").fetchone()
        total_duration_row = conn.execute("SELECT SUM(duration_ms) as total FROM submissions").fetchone()
        ratings_rows = conn.execute(
            """
            SELECT rating_clarity, rating_accuracy, rating_confidence, rating_speed, created_at
            FROM submissions
            """
        ).fetchall()
        recent_rows = conn.execute(
            """
            SELECT s.id, s.created_at, s.duration_ms, s.rating_clarity, s.rating_accuracy,
                   s.rating_confidence, s.rating_speed, o.path as objective_path
            FROM submissions s
            JOIN objectives o ON o.id = s.objective_id
            ORDER BY s.created_at DESC
            LIMIT 10
            """
        ).fetchall()
        objectives = conn.execute(
            "SELECT id, path, prompt, status, created_at, updated_at FROM objectives"
        ).fetchall()

    total_submissions = total_submissions_row["count"] if total_submissions_row else 0
    total_objectives = total_objectives_row["count"] if total_objectives_row else 0
    total_duration_ms = total_duration_row["total"] if total_duration_row and total_duration_row["total"] else 0

    ratings = [
        (row["rating_clarity"] + row["rating_accuracy"] + row["rating_confidence"] + row["rating_speed"]) / 4
        for row in ratings_rows
    ]
    avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else 0.0

    recent_submissions = [
        {
            "id": row["id"],
            "created_at": row["created_at"],
            "duration_ms": row["duration_ms"],
            "avg_rating": round(
                (
                    row["rating_clarity"]
                    + row["rating_accuracy"]
                    + row["rating_confidence"]
                    + row["rating_speed"]
                )
                / 4,
                2,
            ),
            "objective_path": row["objective_path"],
        }
        for row in recent_rows
    ]

    random_objective = ObjectiveOut(**dict(random.choice(objectives))) if objectives else None
    heatmap = _build_heatmap([row["created_at"] for row in ratings_rows])

    return TelemetryOverview(
        total_submissions=total_submissions,
        total_objectives=total_objectives,
        avg_rating=avg_rating,
        total_duration_ms=total_duration_ms,
        recent_submissions=recent_submissions,
        random_objective=random_objective,
        heatmap=heatmap,
    )
