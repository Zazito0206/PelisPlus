const form = document.getElementById("login-form");
const statusNode = document.getElementById("status");
const supabaseClient = window.supabaseAdmin;

function setStatus(message, type = "") {
  statusNode.textContent = message;
  statusNode.className = `status ${type}`.trim();
}

async function redirectIfLoggedIn() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      throw error;
    }

    if (data.session) {
      window.location.href = "/admin/";
    }
  } catch {
    setStatus("Listo para iniciar sesion.");
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  setStatus("Iniciando sesion...");

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: "@Zazo",
        password: "Zazo020623"
      })
    });

    window.location.href = "/admin/";
  } catch (error) {
    setStatus(error.message || "No se pudo iniciar sesion.", "error");
  }
});

redirectIfLoggedIn();
