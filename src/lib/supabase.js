import { createClient } from '@supabase/supabase-js';

// Replace these with the keys from your Supabase dashboard
const supabaseUrl = 'https://rcdqkcyavilgqcxaaliu.supabase.co';
const supabaseKey = 'sb_publishable_wcy7n0OVf_D9uFFD8HBqrQ_zUiylVcA';

// Initialize the Supabase Engine
export const supabase = createClient(supabaseUrl, supabaseKey);