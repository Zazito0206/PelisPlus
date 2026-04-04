const supabaseConfig = window.SUPABASE_CONFIG || {};

if (!window.supabase || !supabaseConfig.url || !supabaseConfig.anonKey) {
  throw new Error("No se pudo inicializar Supabase.");
}

window.supabaseAdmin = window.supabase.createClient(
  supabaseConfig.url,
  supabaseConfig.anonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "pelisplus-auth"
    }
  }
);
