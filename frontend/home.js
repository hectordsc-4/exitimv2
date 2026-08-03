const sessionRaw = localStorage.getItem(SESSION_KEY);

if (!sessionRaw) {
  window.location.href = "/";
} else {
  const session = JSON.parse(sessionRaw);
  const usuario = session.usuario || {};
  const login = session.login || {};
  const permisos = Array.isArray(session.permisos) ? session.permisos : [];

  document.getElementById("user-label").textContent =
    `${usuario.usr_name || ""} (${usuario.usr_codusr || ""})`;

  const logUser =
    usuario.usr_name || usuario.usr_codusr || login.log_codusr || "Usuario";
  document.getElementById("log-usuario").textContent = logUser;

  const feclog = login.log_feclog ? new Date(login.log_feclog) : null;
  const fechaOk = feclog && !Number.isNaN(feclog.getTime());
  document.getElementById("log-fecha").textContent = fechaOk
    ? feclog.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";
  document.getElementById("log-hora").textContent = fechaOk
    ? feclog.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    : "—";
  document.getElementById("log-id-badge").textContent = login.log_logid
    ? `#${login.log_logid}`
    : "#—";
  document.getElementById("log-badge").textContent = login.log_logid ? "1" : "0";

  renderHomeCalendar([]);
  loadHomeEventos(usuario.usr_codusr);

  const isAdmin = permisos.includes("SUPERADMIN") || permisos.includes("ADMIN");
  const isGeneral = permisos.includes("GENERAL") || isAdmin;

  if (isAdmin) {
    const menuAdmin = document.getElementById("menu-admin");
    menuAdmin.classList.remove("hidden");
    setupSideFlyout({
      group: menuAdmin,
      button: document.getElementById("btn-menu-admin"),
      flyout: document.getElementById("flyout-admin"),
    });
  }

  if (isGeneral) {
    const menuGeneral = document.getElementById("menu-general");
    menuGeneral.classList.remove("hidden");
    setupSideFlyout({
      group: menuGeneral,
      button: document.getElementById("btn-menu-general"),
      flyout: document.getElementById("flyout-general"),
    });
    const menuAsistencia = document.getElementById("menu-asistencia");
    if (menuAsistencia) {
      menuAsistencia.classList.remove("hidden");
      setupSideFlyout({
        group: menuAsistencia,
        button: document.getElementById("btn-menu-asistencia"),
        flyout: document.getElementById("flyout-asistencia"),
      });
    }
  }
}

document.getElementById("btn-logout").addEventListener("click", () => {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = "/";
});

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function parseEventDate(iso) {
  if (!iso) return null;
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatEventLine(eve) {
  const d = parseEventDate(eve.exi_feceve);
  if (!d) return eve.exi_nomeve || "—";
  const dm = `${d.getDate()}/${d.getMonth() + 1}`;
  const weekday = capitalize(d.toLocaleDateString("es-ES", { weekday: "long" }));
  return `${dm} ${weekday}, ${eve.exi_nomeve || ""}`.trim();
}

function todayStart() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

async function loadHomeEventos(codusr) {
  const root = document.getElementById("home-events");
  const badge = document.getElementById("eve-badge");
  if (!root) return;

  try {
    // Traemos un lote amplio para marcar el mes en el calendario y listar próximos
    const res = await fetch(`${API_BASE}/api/eventos?limit=200`, {
      headers: {
        "Content-Type": "application/json",
        "X-Usr-Codusr": codusr || "",
      },
    });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Error al cargar eventos");
    const all = Array.isArray(data) ? data : [];

    renderHomeCalendar(all);

    const start = todayStart();
    const proximos = all
      .filter((eve) => {
        const d = parseEventDate(eve.exi_feceve);
        return d && d >= start;
      })
      .sort((a, b) => String(a.exi_feceve).localeCompare(String(b.exi_feceve)))
      .slice(0, 8);

    if (badge) badge.textContent = String(proximos.length);
    if (!proximos.length) {
      root.innerHTML = `<p class="home-events-empty">No hay eventos próximos</p>`;
      return;
    }
    root.innerHTML = proximos
      .map((eve) => {
        const centro = eve.exi_nomcen || eve.exi_codcen || "—";
        return `<article class="home-mini-card">
          <div class="home-mini-top">
            <strong>${esc(formatEventLine(eve))}</strong>
          </div>
          <div class="home-mini-tags">
            <span class="badge nic-tipo">${esc(centro)}</span>
            ${eve.eve_neccir ? '<span class="badge nic-apoyo" title="Necesita circular">CIRCULAR</span>' : ""}
          </div>
        </article>`;
      })
      .join("");
  } catch (_err) {
    if (badge) badge.textContent = "0";
    root.innerHTML = `<p class="home-events-empty">No se pudieron cargar los eventos</p>`;
    renderHomeCalendar([]);
  }
}

function buildEventsByDay(eventos, year, month) {
  const map = new Map();
  (eventos || []).forEach((eve) => {
    const d = parseEventDate(eve.exi_feceve);
    if (!d || d.getFullYear() !== year || d.getMonth() !== month) return;
    const key = d.getDate();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(eve);
  });
  return map;
}

function renderHomeCalendar(eventos) {
  const root = document.getElementById("home-calendar");
  const badge = document.getElementById("cal-badge");
  if (!root) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const byDay = buildEventsByDay(eventos, year, month);
  const eventDays = byDay.size;

  const monthName = now.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  if (badge) badge.textContent = eventDays > 0 ? String(eventDays) : String(today);

  const first = new Date(year, month, 1);
  // Lunes = 0 … Domingo = 6
  const startWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekdays = ["L", "M", "X", "J", "V", "S", "D"];

  let cells = "";
  for (let i = 0; i < startWeekday; i += 1) {
    cells += `<span class="home-cal-day empty" aria-hidden="true"></span>`;
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const isToday = d === today;
    const dayEvents = byDay.get(d) || [];
    const hasEvent = dayEvents.length > 0;
    const needsCir = dayEvents.some((e) => e.eve_neccir);
    const classes = [
      "home-cal-day",
      isToday ? "today" : "",
      hasEvent ? "has-event" : "",
      needsCir ? "needs-cir" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const title = hasEvent
      ? dayEvents
          .map((e) => {
            const cir = e.eve_neccir ? " (circular)" : "";
            return `${e.exi_nomeve || "Evento"}${cir}`;
          })
          .join(" · ")
      : "";
    const attrs = [
      isToday ? 'aria-current="date"' : "",
      hasEvent ? `title="${esc(title)}"` : "",
      hasEvent ? `aria-label="${esc(`${d}: ${title}`)}"` : "",
    ]
      .filter(Boolean)
      .join(" ");
    cells += `<span class="${classes}"${attrs ? ` ${attrs}` : ""}>${d}</span>`;
  }

  root.innerHTML = `
    <p class="home-cal-month">${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</p>
    <div class="home-cal-weekdays">${weekdays.map((w) => `<span>${w}</span>`).join("")}</div>
    <div class="home-cal-grid">${cells}</div>
    ${
      eventDays
        ? `<p class="home-cal-legend"><span class="home-cal-dot" aria-hidden="true"></span> Día con evento${
            eventDays === 1 ? "" : "s"
          }</p>`
        : ""
    }
  `;
}
