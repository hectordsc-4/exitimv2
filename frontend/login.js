const form = document.getElementById("login-form");
const forgotForm = document.getElementById("forgot-form");
const messageEl = document.getElementById("message");
const btn = document.getElementById("btn-login");
const btnForgot = document.getElementById("btn-forgot");
const viewLogin = document.getElementById("view-login");
const viewForgot = document.getElementById("view-forgot");

function setMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message ${type || ""}`.trim();
}

function showLogin() {
  viewForgot.classList.add("hidden");
  viewLogin.classList.remove("hidden");
  setMessage("");
}

function showForgot() {
  viewLogin.classList.add("hidden");
  viewForgot.classList.remove("hidden");
  setMessage("");
}

document.getElementById("link-forgot").addEventListener("click", showForgot);
document.getElementById("link-back").addEventListener("click", showLogin);

const passInput = document.getElementById("usr_pass");
const togglePass = document.getElementById("toggle-pass");
togglePass.addEventListener("click", () => {
  const visible = passInput.type === "text";
  passInput.type = visible ? "password" : "text";
  togglePass.setAttribute("aria-pressed", String(!visible));
  togglePass.setAttribute("aria-label", visible ? "Mostrar contraseña" : "Ocultar contraseña");
  togglePass.title = visible ? "Mostrar contraseña" : "Ocultar contraseña";
  togglePass.querySelector(".eye-open").classList.toggle("hidden", !visible);
  togglePass.querySelector(".eye-closed").classList.toggle("hidden", visible);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");
  btn.disabled = true;

  const usr_codusr = document.getElementById("usr_codusr").value.trim();
  const usr_pass = document.getElementById("usr_pass").value;

  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usr_codusr,
        usr_pass,
        log_dispos: navigator.userAgent.slice(0, 100),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = data.detail || "No se pudo iniciar sesión";
      setMessage(typeof detail === "string" ? detail : "Usuario o contraseña incorrectos", "err");
      return;
    }

    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        usuario: data.usuario,
        login: data.login,
        permisos: data.permisos || [],
      })
    );

    setMessage("Acceso correcto. Redirigiendo…", "ok");
    window.location.href = "/home";
  } catch (error) {
    setMessage("Error de conexión con el servidor.", "err");
  } finally {
    btn.disabled = false;
  }
});

forgotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");
  btnForgot.disabled = true;

  const usr_email = document.getElementById("usr_email").value.trim();

  try {
    const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usr_email }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = data.detail || "No se pudo enviar el recordatorio";
      setMessage(typeof detail === "string" ? detail : "Error al enviar el email", "err");
      return;
    }

    setMessage(data.message || "Revisa tu correo electrónico.", "ok");
  } catch (error) {
    setMessage("Error de conexión con el servidor.", "err");
  } finally {
    btnForgot.disabled = false;
  }
});
