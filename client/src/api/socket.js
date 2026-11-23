import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/useAuthStore';
import { useSessionStore } from '../store/useSessionStore';
import { useUIStore } from '../store/useUIStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socketInstance = null;
let currentAuthKey = '';

export const getSocket = ({ mode = 'staff' } = {}) => {
  const token = useAuthStore.getState().token;
  const sessionToken = useSessionStore.getState().sessionToken;

  const authPayload =
    mode === 'customer'
      ? sessionToken
        ? { sessionToken }
        : null
      : token
      ? { token }
      : sessionToken
      ? { sessionToken }
      : null;

  if (!authPayload) {
    return null;
  }

  const nextAuthKey = JSON.stringify(authPayload);

  if (socketInstance && currentAuthKey !== nextAuthKey) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  if (!socketInstance) {
    currentAuthKey = nextAuthKey;
    socketInstance = io(SOCKET_URL, {
      auth: authPayload,
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketInstance.on('connect', () => {
      useUIStore.getState().setSocketConnected(true);
    });

    socketInstance.on('disconnect', () => {
      useUIStore.getState().setSocketConnected(false);
    });

    socketInstance.on('connect_error', () => {
      useUIStore.getState().setSocketConnected(false);
    });
  } else if (!socketInstance.connected) {
    socketInstance.connect();
  }

  return socketInstance;
};

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    currentAuthKey = '';
    useUIStore.getState().setSocketConnected(false);
  }
};

export const useSocket = (event, handler, options = {}) => {
  const { mode = 'staff', enabled = true } = options;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const staffToken = useAuthStore((s) => s.token);
  const sessionToken = useSessionStore((s) => s.sessionToken);

  useEffect(() => {
    if (!enabled || !event) return;

    const socket = getSocket({ mode });
    if (!socket) return;

    const listener = (payload) => {
      if (handlerRef.current) {
        handlerRef.current(payload);
      }
    };

    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [event, mode, enabled, staffToken, sessionToken]);
};
