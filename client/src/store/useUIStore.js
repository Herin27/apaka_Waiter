import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useUIStore = create(
  persist(
    (set) => ({
      soundEnabled: true,
      language: 'en',
      socketConnected: false,
      kdsStation: 'ALL',
      waiterViewMode: 'map', // 'map' | 'list'

      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
      setSoundEnabled: (enabled) => set({ soundEnabled: Boolean(enabled) }),
      setLanguage: (language) => set({ language }),
      setSocketConnected: (connected) => set({ socketConnected: Boolean(connected) }),
      setKdsStation: (kdsStation) => set({ kdsStation }),
      setWaiterViewMode: (waiterViewMode) => set({ waiterViewMode }),
    }),
    {
      name: 'aapka-waiter-ui',
      partialize: (state) => ({
        soundEnabled: state.soundEnabled,
        language: state.language,
        kdsStation: state.kdsStation,
        waiterViewMode: state.waiterViewMode,
      }),
    }
  )
);
