const supabasePanelAuth = window.supabaseAdmin;

async function ensureAdminSession() {
  try {
    const { data, error } = await supabasePanelAuth.auth.getSession();

    if (error) {
      throw error;
    }

    if (!data.session) {
      window.location.replace("/admin/login/");
      return;
    }

    window.__PELISPLUS_SESSION_READY__ = true;
    window.__PELISPLUS_USER__ = data.session.user || null;
    document.documentElement.dataset.authReady = "true";
    window.dispatchEvent(new CustomEvent("pelisplus:session-ready", {
      detail: data.session
    }));
  } catch {
    window.location.replace("/admin/login/");
  }
}

supabasePanelAuth.auth.onAuthStateChange((_event, session) => {
  if (!session) {
    window.location.replace("/admin/login/");
  }
});

ensureAdminSession();
