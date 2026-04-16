import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useAuthStore = create((set) => ({
  session: null,
  isLoading: true,

  // Check if they are already logged in when the app opens
  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, isLoading: false });

    // Listen for login/logout events
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
    });
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  signOut: async () => {
    await supabase.auth.signOut();
  }
}));