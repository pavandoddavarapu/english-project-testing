// Trigger redeployment with Vercel environment variables
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// The Supabase URL is mapped to your PostgreSQL/Supabase project reference:
const SUPABASE_URL = "https://nwnqehaprqeygpbczbsv.supabase.co";

// The Anon Key is safe to expose on the client-side (public).
// We check for a window global config, and fall back to the placeholder.
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53bnFlaGFwcnFleWdwYmN6YnN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NDE4NzgsImV4cCI6MjA5NjIxNzg3OH0.nNI7rJPXEgBiLq5UbNFhG4d2KU5VdkCa7VOcFypnCS0";

if (SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY_HERE") {
  console.warn("⚠️ [Supabase Auth] SUPABASE_ANON_KEY is set to placeholder. Please update it in assets/js/supabase-config.js or define window.SUPABASE_ANON_KEY in your HTML.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase = supabase;
