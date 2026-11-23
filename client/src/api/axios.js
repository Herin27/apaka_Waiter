import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useSessionStore } from '../store/useSessionStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const isPublicRoute = config.url?.startsWith('/public');

    if (isPublicRoute) {
      const sessionToken = useSessionStore.getState().sessionToken;
      if (sessionToken) {
        config.headers['x-session-token'] = sessionToken;
      }
    } else {
      const token = useAuthStore.getState().token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';
    const isPublicRoute = requestUrl.startsWith('/public');
    const isLoginRequest = requestUrl.includes('/auth/login');

    if (status === 401 && !isPublicRoute && !isLoginRequest) {
      useAuthStore.getState().clearAuth();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
