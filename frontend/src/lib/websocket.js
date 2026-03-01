import io from 'socket.io-client';
import { toast } from 'sonner';

let socket = null;

export const initializeSocket = (token, userId) => {
  if (socket?.connected) {
    return socket;
  }

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  socket = io(BACKEND_URL, {
    auth: {
      token,
      user_id: userId
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('✓ WebSocket connected');
  });

  socket.on('disconnect', () => {
    console.log('✗ WebSocket disconnected');
  });

  socket.on('new_task', (data) => {
    toast.success(
      `New Task: ${data.title}`,
      {
        description: `Assigned by ${data.assigned_by}`,
        duration: 5000,
      }
    );
    
    // Play notification sound
    const audio = new Audio('/notification.mp3');
    audio.play().catch(e => console.log('Audio play failed:', e));
    
    // Show browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('New Task Assigned', {
        body: data.title,
        icon: '/logo192.png',
        tag: `task-${data.task_id}`
      });
    }
  });

  socket.on('indent_updated', (data) => {
    toast.info(
      `Indent ${data.status}`,
      {
        description: data.message,
        duration: 5000,
      }
    );
  });

  socket.on('pong', (data) => {
    console.log('Pong received:', data);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

// Request notification permission
export const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return Notification.permission === 'granted';
};