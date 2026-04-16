import { createClient } from '@supabase/supabase-js';

// Replace these with the keys from your Supabase dashboard
const supabaseUrl = 'https://rcdqkcyavilgqcxaaliu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZHFrY3lhdmlsZ3FjeGFhbGl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTE5ODEsImV4cCI6MjA5MTMyNzk4MX0.3EjiQxpc3VOXois-I7ASfueq9vU-7QeElSUM4sKAHK8';

// Initialize the Supabase Engine
export const supabase = createClient(supabaseUrl, supabaseKey);