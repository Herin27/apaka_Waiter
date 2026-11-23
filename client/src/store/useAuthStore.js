import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/axios';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/login', { email, password });
          const { token, user } = res.data.data;
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          get().fetchMe();
          return user;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      fetchMe: async () => {
        const token = get().token;
        if (!token) return null;
        try {
          const res = await api.get('/auth/me');
          const { user } = res.data.data;
          set({ user, isAuthenticated: true });
          return user;
        } catch {
          set({ user: null, token: null, isAuthenticated: false });
          return null;
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {
          // Ignore network error on logout
        } finally {
          set({ user: null, token: null, isAuthenticated: false });
        }
      },

      clearAuth: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'aapka-waiter-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
