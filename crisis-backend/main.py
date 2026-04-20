"""
╔══════════════════════════════════════════════════════════════╗
║   RAPID CRISIS RESPONSE — FastAPI Backend                    ║
║   WebSocket  ·  YOLOv8 Mock  ·  Alert Broadcasting           ║
╚══════════════════════════════════════════════════════════════╝

Install:
    pip install fastapi uvicorn httpx

Run:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

WebSocket endpoint : ws://localhost:8000/ws
REST  endpoint     : POST /api/alerts
AI simulation      : GET  /api/simulate   (triggers one YOLOv8 mock scan)
"""

import asyncio
import random
import json
import logging
from datetime import datetime
from typing import Optional

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("crisis-cmd")

# ─── App Setup ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Crisis Response Command Center",
    description="Real-time emergency alert system with WebSocket broadcasting",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── In-Memory State ──────────────────────────────────────────────────────────
alert_log: list[dict] = []          # Rolling log of all alerts (last 200)
alert_counter: int = 0              # Auto-increment ID


# ─── Pydantic Models ──────────────────────────────────────────────────────────
class AlertPayload(BaseModel):
    type: str                       # e.g. "fire", "intrusion", "smoke"
    location: str                   # e.g. "Lobby", "Server Room"
    severity: str                   # "critical" | "high" | "medium" | "low"
    confidence: Optional[float] = None   # AI confidence score 0-1
    camera_id: Optional[str] = None      # Source camera identifier
    metadata: Optional[dict] = None      # Any extra context


class AlertResponse(BaseModel):
    id: int
    type: str
    location: str
    severity: str
    confidence: Optional[float]
    camera_id: Optional[str]
    timestamp: str
    broadcast_count: int


# ─── WebSocket Connection Manager ─────────────────────────────────────────────
class ConnectionManager:
    """Manages all active WebSocket connections and broadcasts messages."""

    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        log.info(f"WS connected  → total: {len(self.active)}")

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)
        log.info(f"WS disconnected → total: {len(self.active)}")

    async def broadcast(self, message: dict) -> int:
        """Send JSON payload to every connected client. Returns send count."""
        payload = json.dumps(message)
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.remove(ws)
        return len(self.active)


manager = ConnectionManager()


# ─── YOLOv8 Mock Integration ──────────────────────────────────────────────────
THREAT_TYPES = ["fire", "intrusion", "motion", "smoke", "hazmat", "medical"]

LOCATIONS = [
    "Lobby", "Server Room", "Hall A", "Hall B",
    "Cafeteria", "Parking Lot", "Stairwell East",
    "Exit North", "Exit South", "Reception",
]

SEVERITY_WEIGHTS = {
    "critical": 0.15,
    "high":     0.25,
    "medium":   0.35,
    "low":      0.25,
}

CAMERA_IDS = [f"CAM-{i:03d}" for i in range(1, 25)]


def mock_yolov8_analyze(frame_id: int = 0) -> Optional[dict]:
    """
    Simulates a YOLOv8 computer vision inference pass on a camera frame.

    In production this would:
        model = YOLO("yolov8n.pt")
        results = model(frame)
        detections = results[0].boxes

    Returns an alert payload dict if a threat is detected, else None.
    Detection probability is ~60% per frame (tunable).
    """
    # Simulate frame processing delay
    # In real code: results = model.predict(source=frame, conf=0.4, device="cuda")

    detection_probability = 0.60   # 60% chance of finding a threat per call
    if random.random() > detection_probability:
        log.debug(f"Frame {frame_id}: No threats detected (clear)")
        return None

    threat_type = random.choice(THREAT_TYPES)
    location    = random.choice(LOCATIONS)
    severity    = random.choices(
        list(SEVERITY_WEIGHTS.keys()),
        weights=list(SEVERITY_WEIGHTS.values()),
    )[0]
    confidence  = round(random.uniform(0.62, 0.99), 3)
    camera_id   = random.choice(CAMERA_IDS)

    payload = {
        "type":       threat_type,
        "location":   location,
        "severity":   severity,
        "confidence": confidence,
        "camera_id":  camera_id,
        "metadata": {
            "frame_id":    frame_id,
            "model":       "YOLOv8n-mock",
            "resolution":  "1920x1080",
            "fps":         30,
        },
    }

    log.info(
        f"🤖 YOLOv8 DETECTED │ {threat_type.upper():10s} │ "
        f"{location:16s} │ {severity.upper():8s} │ conf={confidence:.2%}"
    )
    return payload


async def push_alert_to_api(payload: dict):
    """Helper: POST the alert payload to our own /api/alerts endpoint."""
    async with httpx.AsyncClient() as client:
        try:
            await client.post(
                "http://localhost:5500/api/alerts",
                json=payload,
                timeout=5.0,
            )
        except Exception as e:
            log.error(f"Self-call to /api/alerts failed: {e}")


# ─── Background AI Patrol Loop ────────────────────────────────────────────────
async def ai_patrol_loop():
    """
    Continuously simulates camera feeds being analyzed by YOLOv8.
    Runs as a background task on startup.
    Interval: every 10–20 seconds (randomized to mimic real feed variance).
    """
    frame_counter = 0
    log.info("🚀 AI patrol loop started — scanning camera feeds…")
    while True:
        interval = random.uniform(10, 20)
        await asyncio.sleep(interval)

        frame_counter += 1
        result = mock_yolov8_analyze(frame_id=frame_counter)
        if result:
            await push_alert_to_api(result)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(ai_patrol_loop())
    log.info("✅ Crisis Command Center backend online")


# ─── REST Endpoints ───────────────────────────────────────────────────────────
@app.post("/api/alerts", response_model=AlertResponse, status_code=201)
async def receive_alert(payload: AlertPayload):
    """
    Receive an emergency alert (from AI cameras, IoT sensors, or manual reports).
    Stores it and broadcasts to all connected WebSocket clients immediately.
    """
    global alert_counter
    alert_counter += 1

    alert = {
        "id":         alert_counter,
        "type":       payload.type,
        "location":   payload.location,
        "severity":   payload.severity,
        "confidence": payload.confidence,
        "camera_id":  payload.camera_id,
        "timestamp":  datetime.utcnow().isoformat() + "Z",
        "metadata":   payload.metadata or {},
    }

    # Store (keep last 200)
    alert_log.append(alert)
    if len(alert_log) > 200:
        alert_log.pop(0)

    # Broadcast via WebSocket
    broadcast_count = await manager.broadcast({
        "event": "NEW_ALERT",
        "data":  alert,
    })

    log.info(
        f"📡 ALERT #{alert['id']:04d} │ {alert['type'].upper():10s} │ "
        f"{alert['location']:16s} │ {alert['severity'].upper():8s} │ "
        f"broadcast→{broadcast_count} clients"
    )

    return {**alert, "broadcast_count": broadcast_count}


@app.get("/api/alerts")
async def get_alerts(limit: int = 50):
    """Return the N most recent alerts."""
    return {"alerts": alert_log[-limit:], "total": len(alert_log)}


@app.get("/api/simulate")
async def trigger_simulation(background_tasks: BackgroundTasks):
    """
    Manually trigger one YOLOv8 mock scan.
    Useful for testing without waiting for the patrol loop.
    """
    result = mock_yolov8_analyze(frame_id=9999)
    if result:
        background_tasks.add_task(push_alert_to_api, result)
        return {"status": "threat_detected", "payload": result}
    return {"status": "clear", "message": "No threats detected in this frame."}


@app.get("/api/health")
async def health_check():
    return {
        "status":          "online",
        "ws_connections":  len(manager.active),
        "total_alerts":    len(alert_log),
        "alert_counter":   alert_counter,
        "timestamp":       datetime.utcnow().isoformat() + "Z",
    }


# ─── WebSocket Endpoint ───────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """
    Frontend connects here to receive real-time alert events.

    Message types pushed to client:
        { "event": "NEW_ALERT",   "data": { ...alert } }
        { "event": "SYSTEM_PING", "data": { "ts": "..." } }

    Messages accepted from client:
        { "action": "RESOLVE_ALERT", "id": 42 }
        { "action": "PING" }
    """
    await manager.connect(ws)

    # Send recent history on connect so the dashboard isn't blank
    await ws.send_text(json.dumps({
        "event": "HISTORY",
        "data":  alert_log[-20:],
    }))

    # Start a ping task to keep the connection alive
    async def ping_loop():
        while True:
            await asyncio.sleep(30)
            try:
                await ws.send_text(json.dumps({
                    "event": "SYSTEM_PING",
                    "data":  {"ts": datetime.utcnow().isoformat() + "Z"},
                }))
            except Exception:
                break

    ping_task = asyncio.create_task(ping_loop())

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
                action = msg.get("action")

                if action == "RESOLVE_ALERT":
                    alert_id = msg.get("id")
                    # In production: update DB record, notify all clients
                    await manager.broadcast({
                        "event": "ALERT_RESOLVED",
                        "data":  {"id": alert_id, "resolved_at": datetime.utcnow().isoformat() + "Z"},
                    })
                    log.info(f"✅ Alert #{alert_id} resolved via WebSocket")

                elif action == "PING":
                    await ws.send_text(json.dumps({"event": "PONG"}))

            except json.JSONDecodeError:
                log.warning(f"Malformed WS message: {raw[:100]}")

    except WebSocketDisconnect:
        ping_task.cancel()
        manager.disconnect(ws)


# ─── Dev runner ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5500, reload=True)
