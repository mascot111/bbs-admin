import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAdminStore = create(
  persist(
    (set) => ({
      isShiftActive: false,
      startShift: () => set({ isShiftActive: true }),
      endShift: () => set({ isShiftActive: false }),
    }),
    { 
      name: 'bbs-admin-shift-storage' // Saves shift state to browser LocalStorage
    }
  )
);