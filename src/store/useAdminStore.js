import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export const useAdminStore = create(
  persist(
    (set, get) => ({
      // --- 1. EXISTING SHIFT LOGIC (Persisted) ---
      isShiftActive: false,
      startShift: () => set({ isShiftActive: true }),
      endShift: () => set({ isShiftActive: false }),

      // --- 2. NEW RADAR LOGIC (Memory Only) ---
      orders: [],
      activeRiders: [],
      isLoading: false,

      fetchDashboardData: async () => {
        set({ isLoading: true });
        
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const { data: ordersData } = await supabase
          .from('orders')
          .select('*')
          .gte('created_at', startOfToday.toISOString())
          .order('created_at', { ascending: false });

        const { data: ridersData } = await supabase
          .from('riders')
          .select('*')
          .in('status', ['available', 'busy']);

        set({ 
          orders: ordersData || [], 
          activeRiders: ridersData || [],
          isLoading: false 
        });
      },

      initializeRadar: () => {
        const ordersSubscription = supabase
          .channel('admin-orders-radar')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            
            set((state) => {
              if (eventType === 'INSERT') return { orders: [newRecord, ...state.orders] };
              if (eventType === 'UPDATE') return { orders: state.orders.map(o => o.id === newRecord.id ? newRecord : o) };
              if (eventType === 'DELETE') return { orders: state.orders.filter(o => o.id !== oldRecord.id) };
              return state;
            });
          })
          .subscribe();

        const ridersSubscription = supabase
          .channel('admin-riders-radar')
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'riders' }, (payload) => {
            const { new: updatedRider } = payload;
            
            set((state) => {
              const exists = state.activeRiders.some(r => r.id === updatedRider.id);
              let newRiders = [...state.activeRiders];
              
              if (updatedRider.status === 'offline') {
                newRiders = newRiders.filter(r => r.id !== updatedRider.id);
              } else if (exists) {
                newRiders = newRiders.map(r => r.id === updatedRider.id ? updatedRider : r);
              } else {
                newRiders.push(updatedRider);
              }
              
              return { activeRiders: newRiders };
            });
          })
          .subscribe();

        return () => {
          supabase.removeChannel(ordersSubscription);
          supabase.removeChannel(ridersSubscription);
        };
      }
    }),
    { 
      name: 'bbs-admin-shift-storage',
      // CRITICAL: Only save the shift state to LocalStorage. Let the radar pull fresh data on every reload.
      partialize: (state) => ({ isShiftActive: state.isShiftActive }),
    }
  )
);