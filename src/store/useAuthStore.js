import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// Security Protocol: Define the ONLY email(s) allowed to access the Control Center.
const AUTHORIZED_ADMIN_EMAILS = [
  'admin@bbseats.com', // Replace this with your actual admin email
  // You can add a secondary admin email here if needed
];

export const useAuthStore = create((set) => ({
  session: null,
  user: null, // Track the user object so we can display their initial in the layout
  isLoading: true,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Extra security: If a non-admin somehow has a valid session token, kick them out on load.
    if (session && !AUTHORIZED_ADMIN_EMAILS.includes(session.user.email)) {
      await supabase.auth.signOut();
      set({ session: null, user: null, isLoading: false });
      return;
    }

    set({ session, user: session?.user || null, isLoading: false });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user || null });
    });
  },

  signIn: async (email, password) => {
    // 1. The Gatekeeper Check: Reject instantly if the email is not on the list.
    if (!AUTHORIZED_ADMIN_EMAILS.includes(email)) {
      throw new Error("Unauthorized access. This email does not have Admin privileges.");
    }

    // 2. If authorized, proceed with the actual Supabase login
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    
    return data;
  },

  signOut: async () => {
    await supabase.auth.signOut();
  }
}));