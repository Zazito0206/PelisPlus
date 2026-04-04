const publicSupabaseConfig = window.SUPABASE_CONFIG || {};

if (!window.supabase || !publicSupabaseConfig.url || !publicSupabaseConfig.anonKey) {
  throw new Error("No se pudo inicializar Supabase.");
}

window.supabasePublic = window.supabase.createClient(
  publicSupabaseConfig.url,
  publicSupabaseConfig.anonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);
