from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .schemas import (
    EdgeSeriesResponse,
    ReadingResponse,
    WeightUpdateRequest,
    WeightUpdateResponse,
)
from .store import GraphStore


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def broadcast(self, message: dict) -> None:
        dead_connections = []
        for ws in self._connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead_connections.append(ws)
        for ws in dead_connections:
            self.disconnect(ws)


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "graph.json"
READINGS_DIR = BASE_DIR / "data" / "readings"

app = FastAPI(title="Crumbl CDMX Emotion Graph API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = GraphStore(DATA_PATH)
manager = ConnectionManager()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/v1/graph")
def get_graph(
    lang: str = Query(default="es", pattern="^(es|en)$"),
    week: str | None = Query(default=None, pattern=r"^\d{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$"),
):
    return store.get_graph(lang=lang, week=week)


@app.get("/v1/readings/{week}", response_model=ReadingResponse)
def get_reading(week: str):
    # Try week-crumbl-cdmx.json first, then any json in readings dir matching week
    reading_path = READINGS_DIR / f"{week}-crumbl-cdmx.json"
    if not reading_path.exists():
        candidates = list(READINGS_DIR.glob(f"{week}-*.json"))
        if candidates:
            reading_path = candidates[0]
        else:
            raise HTTPException(status_code=404, detail="Reading not found for this week")

    with reading_path.open("r", encoding="utf-8-sig") as f:
        payload = json.load(f)

    payload.setdefault("relations", [])
    payload.setdefault("dimensions", [])
    return ReadingResponse.model_validate(payload)


@app.get("/v1/nodes/{node_id}")
def get_node(
    node_id: str,
    lang: str = Query(default="es", pattern="^(es|en)$"),
    week: str | None = Query(default=None, pattern=r"^\d{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$"),
):
    try:
        return store.get_node_detail(node_id=node_id, lang=lang, week=week)
    except KeyError:
        raise HTTPException(status_code=404, detail="Node not found") from None


@app.get("/v1/edges/{edge_id}/weights", response_model=EdgeSeriesResponse)
def get_edge_weights(
    edge_id: str,
    from_week: str | None = Query(default=None, alias="from", pattern=r"^\d{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$"),
    to_week: str | None = Query(default=None, alias="to", pattern=r"^\d{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$"),
):
    try:
        points = store.edge_series(edge_id=edge_id, week_from=from_week, week_to=to_week)
        return EdgeSeriesResponse(edge_id=edge_id, points=points)
    except KeyError:
        raise HTTPException(status_code=404, detail="Edge not found") from None


@app.put("/v1/edges/{edge_id}/weights/{week}", response_model=WeightUpdateResponse)
async def put_edge_weight(edge_id: str, week: str, body: WeightUpdateRequest):
    try:
        edge_id, week, value, updated_at = store.update_edge_weight(
            edge_id=edge_id,
            week=week,
            value=body.value,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Edge not found") from None

    await manager.broadcast(
        {
            "type": "edge_weight_updated",
            "edge_id": edge_id,
            "week": week,
            "value": value,
            "actor": body.actor,
            "source": body.source,
            "updated_at": updated_at.isoformat(),
        }
    )

    return WeightUpdateResponse(edge_id=edge_id, week=week, value=value, updated_at=updated_at)


@app.websocket("/ws/events")
async def ws_events(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
