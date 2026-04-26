# LOCATION: backend/routers/ws.py
# WebSocket connection manager + debate streaming router

import asyncio, json, logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from models.schemas import WSEvent, WSEventType, ApprovalResponse
from services import redis_client

logger = logging.getLogger(__name__)
router = APIRouter()


class ConnectionManager:
    """Manages all active WebSocket connections, grouped by debate_id."""

    def __init__(self):
        # debate_id -> set of WebSocket connections
        self.connections: dict[str, set[WebSocket]] = {}

    async def connect(self, debate_id: str, ws: WebSocket):
        await ws.accept()
        if debate_id not in self.connections:
            self.connections[debate_id] = set()
        self.connections[debate_id].add(ws)
        logger.info(f"[WS] Client connected to debate {debate_id}. Total: {len(self.connections[debate_id])}")

    def disconnect(self, debate_id: str, ws: WebSocket):
        if debate_id in self.connections:
            self.connections[debate_id].discard(ws)
            if not self.connections[debate_id]:
                del self.connections[debate_id]
        logger.info(f"[WS] Client disconnected from debate {debate_id}")

    async def broadcast(self, debate_id: str, event: WSEvent):
        """Send event to all clients watching this debate."""
        if debate_id not in self.connections:
            return
        dead = set()
        message = event.model_dump_json()
        for ws in self.connections[debate_id].copy():
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.connections[debate_id].discard(ws)

    async def send_to(self, ws: WebSocket, event: WSEvent):
        """Send event to a specific client."""
        try:
            await ws.send_text(event.model_dump_json())
        except Exception as e:
            logger.warning(f"[WS] Failed to send to client: {e}")


manager = ConnectionManager()


def make_ws_callback(debate_id: str):
    """Returns an async callback that broadcasts WS events to all debate watchers."""
    async def callback(event: WSEvent):
        await manager.broadcast(debate_id, event)
    return callback


@router.websocket("/ws/debates/{debate_id}")
async def debate_websocket(ws: WebSocket, debate_id: str):
    await manager.connect(debate_id, ws)

    # Send initial ping
    await manager.send_to(ws, WSEvent(
        type=WSEventType.ping,
        debate_id=debate_id,
        payload={"message": "Connected to WarRoom"},
    ))

    try:
        while True:
            # Listen for messages from the client (approvals, interrupts, etc.)
            try:
                raw = await asyncio.wait_for(ws.receive_text(), timeout=30.0)
                data = json.loads(raw)
                await handle_client_message(debate_id, data, ws)
            except asyncio.TimeoutError:
                # Send keepalive ping
                await manager.send_to(ws, WSEvent(
                    type=WSEventType.ping,
                    debate_id=debate_id,
                    payload={"keepalive": True},
                ))
            except WebSocketDisconnect:
                break

    except Exception as e:
        logger.error(f"[WS] Error in debate {debate_id}: {e}")
    finally:
        manager.disconnect(debate_id, ws)


async def handle_client_message(debate_id: str, data: dict, ws: WebSocket):
    """Process incoming messages from the frontend client."""
    msg_type = data.get("type")

    if msg_type == "approval_response":
        # Human approved or rejected a tool call
        response = ApprovalResponse(**data.get("payload", {}))
        await redis_client.set_approval_response(
            debate_id=debate_id,
            request_id=response.request_id,
            response={"approved": response.approved, "reason": response.reason},
        )
        logger.info(f"[WS] Approval response for {response.request_id}: {response.approved}")

    elif msg_type == "ping":
        await manager.send_to(ws, WSEvent(
            type=WSEventType.ping,
            debate_id=debate_id,
            payload={"pong": True},
        ))

    else:
        logger.warning(f"[WS] Unknown message type from client: {msg_type}")