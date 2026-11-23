import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSessionStore = create(
  persist(
    (set) => ({
      sessionToken: null,
      sessionId: null,
      branchSlug: null,
      qrToken: null,
      guest: null,
      table: null,
      cart: [],
      subtotal: 0,

      setSession: ({ sessionToken, session, guest, table, branchSlug, qrToken }) => {
        const nextCart = session?.cart || [];
        const nextSubtotal = nextCart.reduce((acc, item) => acc + item.price * item.qty, 0);
        set({
          sessionToken,
          sessionId: session?._id || session?.id || null,
          branchSlug: branchSlug || null,
          qrToken: qrToken || null,
          guest: guest || null,
          table: table || null,
          cart: nextCart,
          subtotal: Math.round((nextSubtotal + Number.EPSILON) * 100) / 100,
        });
      },

      setCart: (cart = [], subtotal) => {
        const computedSubtotal =
          subtotal !== undefined
            ? subtotal
            : cart.reduce((acc, item) => acc + item.price * item.qty, 0);
        set({
          cart,
          subtotal: Math.round((computedSubtotal + Number.EPSILON) * 100) / 100,
        });
      },

      setTable: (table) => set({ table }),

      clearSession: () =>
        set({
          sessionToken: null,
          sessionId: null,
          branchSlug: null,
          qrToken: null,
          guest: null,
          table: null,
          cart: [],
          subtotal: 0,
        }),
    }),
    {
      name: 'aapka-waiter-customer-session',
    }
  )
);
