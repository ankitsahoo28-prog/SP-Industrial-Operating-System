import socketio
import logging
from typing import Dict, Set

logger = logging.getLogger(__name__)

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False
)

# Store connected users
connected_users: Dict[str, Set[str]] = {}  # user_id -> set of session_ids

@sio.event
async def connect(sid, environ, auth):
    """Handle client connection"""
    logger.info(f"Client connected: {sid}")
    if auth and 'user_id' in auth:
        user_id = auth['user_id']
        if user_id not in connected_users:
            connected_users[user_id] = set()
        connected_users[user_id].add(sid)
        logger.info(f"User {user_id} connected with session {sid}")

@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    logger.info(f"Client disconnected: {sid}")
    # Remove from connected users
    for user_id, sessions in list(connected_users.items()):
        if sid in sessions:
            sessions.remove(sid)
            if not sessions:
                del connected_users[user_id]
            break

@sio.event
async def ping(sid, data):
    """Handle ping from client"""
    await sio.emit('pong', {'timestamp': data.get('timestamp')}, room=sid)

async def notify_user(user_id: str, event: str, data: dict):
    """Send notification to a specific user"""
    if user_id in connected_users:
        for sid in connected_users[user_id]:
            await sio.emit(event, data, room=sid)
        logger.info(f"Sent {event} to user {user_id}")

async def notify_role(role: str, event: str, data: dict):
    """Send notification to all users with a specific role"""
    # This would require maintaining role->users mapping
    # For now, we'll implement user-specific notifications
    pass

async def broadcast(event: str, data: dict):
    """Send notification to all connected clients"""
    await sio.emit(event, data)
    logger.info(f"Broadcast {event} to all users")