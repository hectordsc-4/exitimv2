(() => {
  const sessionRaw = localStorage.getItem(SESSION_KEY);
  if (!sessionRaw) {
    window.location.href = "/";
    return;
  }

  const session = JSON.parse(sessionRaw);
  const usuario = session.usuario || {};
  const permisos = Array.isArray(session.permisos) ? session.permisos : [];
  const isSuperAdmin =
    permisos.includes("SUPERADMIN") || usuario.usr_tipusr === "SUPERADMIN";
  const isAdmin = isSuperAdmin || permisos.includes("ADMIN");

  if (!isAdmin) {
    window.location.href = "/home";
    return;
  }

  const state = {
    section: "usuarios",
    usuarios: [],
    permisos: [],
    asignaciones: [],
    eventos: [],
    centros: [],
    logs: [],
    resumen: null,
    selectedDia: null,
    search: "",
  };

  const els = {
    userLabel: document.getElementById("user-label"),
    search: document.getElementById("global-search"),
    pillRow: document.getElementById("pill-row"),
    toast: document.getElementById("toast"),
    modal: document.getElementById("modal"),
    modalTitle: document.getElementById("modal-title"),
    modalForm: document.getElementById("modal-form"),
    modalMsg: document.getElementById("modal-msg"),
    logDesde: document.getElementById("log-desde"),
    logHasta: document.getElementById("log-hasta"),
    logUsuario: document.getElementById("log-usuario"),
  };

  els.userLabel.textContent = `${usuario.usr_name || ""} (${usuario.usr_codusr || ""})`;

  const today = new Date();
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(today.getDate() - 13);
  els.logHasta.value = isoDate(today);
  els.logDesde.value = isoDate(twoWeeksAgo);
  if (typeof ExiDates !== "undefined") ExiDates.bind(document);

  document.getElementById("btn-logout").addEventListener("click", () => {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "/";
  });

  const menuAdmin = document.getElementById("menu-admin");
  const btnMenuAdmin = document.getElementById("btn-menu-admin");
  const flyoutAdmin = document.getElementById("flyout-admin");

  setupSideFlyout({
    group: menuAdmin,
    button: btnMenuAdmin,
    flyout: flyoutAdmin,
    onSelect: (section) => switchSection(section),
  });

  setupSideFlyout({
    group: document.getElementById("menu-general"),
    button: document.getElementById("btn-menu-general"),
    flyout: document.getElementById("flyout-general"),
  });

  setupSideFlyout({
    group: document.getElementById("menu-asistencia"),
    button: document.getElementById("btn-menu-asistencia"),
    flyout: document.getElementById("flyout-asistencia"),
  });

  els.search.addEventListener("input", () => {
    state.search = els.search.value.trim().toLowerCase();
    renderActive();
  });

  document.getElementById("btn-aplicar-logs").addEventListener("click", () => loadLogs());

  document.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  const hashSection = (location.hash || "").replace("#", "");
  if (["usuarios", "permisos", "asignaciones", "eventos", "logs", "sql"].includes(hashSection)) {
    state.section = hashSection;
  }
  function isoDate(d) {
    return d.toISOString().slice(0, 10);
  }

  function authHeaders(extra = {}) {
    return {
      "Content-Type": "application/json",
      "X-Usr-Codusr": usuario.usr_codusr,
      ...extra,
    };
  }

  async function api(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: authHeaders(options.headers || {}),
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((d) => d.msg || JSON.stringify(d)).join("; ")
            : "Error en la petición";
      throw new Error(msg);
    }
    return data;
  }

  function toast(text, type = "ok") {
    els.toast.textContent = text;
    els.toast.className = `admin-toast ${type}`;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.add("hidden"), 4000);
  }

  /** Una pregunta con Sí / No */
  function askConfirm(message, title = "Confirmar") {
    const modal = document.getElementById("confirm-modal");
    const textEl = document.getElementById("confirm-text");
    const titleEl = document.getElementById("confirm-title");
    const btnYes = document.getElementById("confirm-yes");
    const btnNo = document.getElementById("confirm-no");
    const backdrop = document.getElementById("confirm-backdrop");

    titleEl.textContent = title;
    textEl.textContent = message;
    modal.classList.remove("hidden");

    return new Promise((resolve) => {
      const finish = (value) => {
        modal.classList.add("hidden");
        btnYes.removeEventListener("click", onYes);
        btnNo.removeEventListener("click", onNo);
        backdrop.removeEventListener("click", onNo);
        document.removeEventListener("keydown", onKey);
        resolve(value);
      };
      const onYes = () => finish(true);
      const onNo = () => finish(false);
      const onKey = (ev) => {
        if (ev.key === "Escape") finish(false);
        if (ev.key === "Enter") finish(true);
      };
      btnYes.addEventListener("click", onYes);
      btnNo.addEventListener("click", onNo);
      backdrop.addEventListener("click", onNo);
      document.addEventListener("keydown", onKey);
      btnYes.focus();
    });
  }

  /** Doble confirmación antes de borrar de la BD */
  async function confirmBorrarRegistro(detalle) {
    const paso1 = await askConfirm(
      `¿Estás seguro de borrar este registro?\n\n${detalle}`,
      "Borrar registro"
    );
    if (!paso1) return false;
    const paso2 = await askConfirm(
      "Si pulsas Sí, el registro se eliminará de la base de datos y no se podrá recuperar.\n\n¿Confirmas el borrado?",
      "Confirmar borrado"
    );
    return paso2;
  }

  function fmtDate(value) {
    if (!value) return "—";
    return new Date(value).toLocaleString("es-ES");
  }

  function fmtDay(iso) {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  }

  function matchSearch(row, fields) {
    if (!state.search) return true;
    return fields.some((f) => String(f ?? "").toLowerCase().includes(state.search));
  }

  function switchSection(name) {
    state.section = name;
    history.replaceState(null, "", `#${name}`);

    document.querySelectorAll(".flyout-link[data-section]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.section === name);
    });
    btnMenuAdmin.classList.add("active");

    document.querySelectorAll(".admin-section").forEach((sec) => {
      sec.classList.toggle("hidden", sec.dataset.section !== name);
    });
    els.search.placeholder =
      name === "logs"
        ? "Filtrar detalle de logs…"
        : name === "sql"
          ? "Buscar en el resultado SQL…"
          : "Buscar en la tabla activa…";
    renderPills();
    renderActive();
  }

  function renderPills() {
    const map = {
      usuarios: [
        { label: "Nuevo usuario", action: () => openUsuarioModal() },
        { label: "Actualizar", action: () => loadUsuarios().then(() => toast("Usuarios actualizados")) },
        { label: "Descargar", action: () => downloadTableCsv("#tabla-usuarios", "exi_usuarios"), download: true },
      ],
      permisos: [
        { label: "Nuevo permiso", action: () => openPermisoModal() },
        { label: "Actualizar", action: () => loadPermisos().then(() => toast("Permisos actualizados")) },
        { label: "Descargar", action: () => downloadTableCsv("#tabla-permisos", "exi_permisos"), download: true },
      ],
      asignaciones: [
        { label: "Asignar permiso", action: () => openAsignacionModal() },
        { label: "Actualizar", action: () => loadAsignaciones().then(() => toast("Asignaciones actualizadas")) },
        { label: "Descargar", action: () => downloadTableCsv("#tabla-asignaciones", "exi_permisos_usuario"), download: true },
      ],
      eventos: [
        { label: "Nuevo evento", action: () => openEventoModal() },
        { label: "Actualizar", action: () => loadEventos().then(() => toast("Eventos actualizados")) },
        { label: "Descargar", action: () => downloadTableCsv("#tabla-eventos", "exi_eventos"), download: true },
      ],
      logs: [
        { label: "Recargar logs", action: () => loadLogs().then(() => toast("Logs actualizados")) },
        { label: "Descargar", action: () => downloadTableCsv("#tabla-logs", "exi_logins"), download: true },
      ],
      sql: [
        { label: "Ejecutar", action: () => runSql() },
        { label: "Descargar", action: () => downloadTableCsv("#tabla-sql", "sql_resultado"), download: true },
      ],
    };
    els.pillRow.innerHTML = "";
    (map[state.section] || []).forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = item.download ? "pill-btn solid" : "pill-btn ghost";
      btn.textContent = item.label;
      if (item.download) {
        btn.title = "Descargar el grid visible (CSV)";
        btn.innerHTML = `<span class="pill-ico" aria-hidden="true">⬇</span> Descargar`;
      }
      btn.addEventListener("click", item.action);
      els.pillRow.appendChild(btn);
    });
  }

  function renderActive() {
    if (state.section === "usuarios") renderUsuarios();
    if (state.section === "permisos") renderPermisos();
    if (state.section === "asignaciones") renderAsignaciones();
    if (state.section === "eventos") renderEventos();
    if (state.section === "logs") renderLogs();
    if (state.section === "sql") renderSqlResult();
  }

  // -------- Usuarios --------
  async function loadUsuarios() {
    state.usuarios = await api("/api/usuarios");
    fillLogUserSelect();
    renderUsuarios();
  }

  const TIPOS_USUARIO = [
    { value: "SUPERADMIN", label: "SUPERADMIN" },
    { value: "ADMIN", label: "ADMIN" },
    { value: "DIRECTOR", label: "DIRECTOR" },
    { value: "MONITOR", label: "MONITOR" },
  ];

  function tipusrLabel(u) {
    const tip = u.usr_tipusr || "";
    if (!tip) return "—";
    if (tip === "SUPERADMIN" || tip === "ADMIN") {
      return `<span class="badge ok">${esc(tip)}</span>`;
    }
    return `<span class="badge">${esc(tip)}</span>`;
  }

  function monitorLabel(u) {
    if (u.mon_codmon != null) {
      return `<strong>#${esc(u.mon_codmon)}</strong> ${esc(u.mon_nommon || "")}`.trim();
    }
    return "—";
  }

  function renderUsuarios() {
    const tbody = document.querySelector("#tabla-usuarios tbody");
    const rows = state.usuarios.filter((u) =>
      matchSearch(u, [
        u.usr_codusr,
        u.usr_name,
        u.usr_email,
        u.usr_descri,
        u.usr_tipusr,
        u.mon_nommon,
        u.mon_codmon != null ? String(u.mon_codmon) : "",
      ])
    );
    document.getElementById("count-usuarios").textContent = String(rows.length);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No hay usuarios</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map((u) => {
        const baja = Boolean(u.usr_fecbaj);
        return `<tr>
          <td><strong>${esc(u.usr_codusr)}</strong></td>
          <td>${esc(u.usr_name)}</td>
          <td>${esc(u.usr_email || "—")}</td>
          <td>${tipusrLabel(u)}</td>
          <td>${monitorLabel(u)}</td>
          <td>${esc(fmtDate(u.user_feccre))}</td>
          <td>${baja ? '<span class="badge off">Baja</span>' : '<span class="badge ok">Activo</span>'}</td>
          <td class="row-actions">
            <button type="button" class="linkish" data-act="edit-usr" data-id="${esc(u.usr_codusr)}">Editar</button>
            ${
              baja
                ? `<button type="button" class="linkish" data-act="react-usr" data-id="${esc(u.usr_codusr)}" title="Quitar fecha de baja">Reactivar</button>`
                : `<button type="button" class="linkish danger" data-act="baja-usr" data-id="${esc(u.usr_codusr)}" title="Baja lógica (se puede reactivar)">Baja</button>`
            }
            <button type="button" class="linkish danger" data-act="del-usr" data-id="${esc(u.usr_codusr)}" title="Eliminar definitivamente de la base de datos">Borrado</button>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const u = state.usuarios.find((x) => x.usr_codusr === id);
        try {
          if (btn.dataset.act === "edit-usr") openUsuarioModal(u);
          if (btn.dataset.act === "baja-usr") {
            const ok1 = await askConfirm(
              `¿Estás seguro de dar de baja este registro?\n\nUsuario: ${id}`,
              "Baja"
            );
            if (!ok1) return;
            const ok2 = await askConfirm(
              "Si pulsas Sí, el usuario quedará de baja (no podrá entrar). Podrás reactivarlo después.\n\n¿Confirmas la baja?",
              "Confirmar baja"
            );
            if (!ok2) return;
            await api(`/api/usuarios/${encodeURIComponent(id)}`, { method: "DELETE" });
            toast(`Usuario ${id} dado de baja`);
            await loadUsuarios();
          }
          if (btn.dataset.act === "react-usr") {
            const ok = await askConfirm(`¿Reactivar al usuario ${id}?`, "Reactivar");
            if (!ok) return;
            await api(`/api/usuarios/${encodeURIComponent(id)}/reactivar`, { method: "POST" });
            toast(`Usuario ${id} reactivado`);
            await loadUsuarios();
          }
          if (btn.dataset.act === "del-usr") {
            const ok = await confirmBorrarRegistro(`Usuario: ${id}`);
            if (!ok) return;
            await api(`/api/usuarios/${encodeURIComponent(id)}/permanente`, { method: "DELETE" });
            toast(`Usuario ${id} eliminado de la base de datos`);
            await loadUsuarios();
          }
        } catch (err) {
          toast(err.message, "err");
        }
      });
    });
  }

  function openUsuarioModal(existing) {
    const isEdit = Boolean(existing);
    const tipOpts = TIPOS_USUARIO.filter(
      (t) => isSuperAdmin || t.value !== "SUPERADMIN" || existing?.usr_tipusr === "SUPERADMIN"
    );
    const camposExtra = [];
    if (isEdit) {
      camposExtra.push(
        field(
          "monitor_info",
          "Monitor",
          existing.mon_codmon != null
            ? `#${existing.mon_codmon} — ${existing.mon_nommon || ""}`
            : "No es usuario de monitor",
          { disabled: true }
        )
      );
    }
    openModal(isEdit ? "Editar usuario" : "Nuevo usuario", [
      field("usr_codusr", "Código", existing?.usr_codusr || "", { required: true, disabled: isEdit, maxlength: 20 }),
      field("usr_name", "Nombre", existing?.usr_name || "", { required: true, maxlength: 200 }),
      selectField("usr_tipusr", "Tipo usuario", tipOpts, {
        required: true,
        value: existing?.usr_tipusr || "DIRECTOR",
      }),
      field("usr_email", "Email", existing?.usr_email || "", { type: "email", maxlength: 200 }),
      field("usr_pass", "Contraseña", "", { type: "password", required: !isEdit, maxlength: 200, placeholder: isEdit ? "Dejar vacío para no cambiar" : "" }),
      field("usr_descri", "Descripción", existing?.usr_descri || "", { maxlength: 200 }),
      ...camposExtra,
    ], async (data) => {
      const tip = String(data.usr_tipusr || "").trim().toUpperCase();
      if (!["SUPERADMIN", "ADMIN", "DIRECTOR", "MONITOR"].includes(tip)) {
        throw new Error("Selecciona un tipo de usuario válido");
      }
      if (isEdit) {
        const body = {
          usr_name: data.usr_name,
          usr_email: data.usr_email || null,
          usr_descri: data.usr_descri || null,
          usr_tipusr: tip,
        };
        if (data.usr_pass) body.usr_pass = data.usr_pass;
        await api(`/api/usuarios/${encodeURIComponent(existing.usr_codusr)}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        toast("Usuario actualizado");
      } else {
        await api("/api/usuarios", {
          method: "POST",
          body: JSON.stringify({
            usr_codusr: data.usr_codusr,
            usr_name: data.usr_name,
            usr_email: data.usr_email || null,
            usr_pass: data.usr_pass,
            usr_descri: data.usr_descri || null,
            usr_tipusr: tip,
            usr_usrcre: usuario.usr_codusr,
          }),
        });
        toast("Usuario creado");
      }
      await loadUsuarios();
    });
  }

  // -------- Permisos --------
  async function loadPermisos() {
    state.permisos = await api("/api/permisos");
    renderPermisos();
  }

  function renderPermisos() {
    const tbody = document.querySelector("#tabla-permisos tbody");
    const rows = state.permisos.filter((p) =>
      matchSearch(p, [p.per_codper, p.per_nomper, p.per_usrcre])
    );
    document.getElementById("count-permisos").textContent = String(rows.length);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No hay permisos</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map((p) => {
        const baja = Boolean(p.per_fecbaj);
        return `<tr>
          <td><strong>${esc(p.per_codper)}</strong></td>
          <td>${esc(p.per_nomper)}</td>
          <td>${esc(fmtDate(p.per_feccre))}</td>
          <td>${esc(p.per_usrcre || "—")}</td>
          <td>${baja ? '<span class="badge off">Baja</span>' : '<span class="badge ok">Activo</span>'}</td>
          <td class="row-actions">
            <button type="button" class="linkish" data-act="edit-per" data-id="${esc(p.per_codper)}">Editar</button>
            ${
              baja
                ? `<button type="button" class="linkish" data-act="react-per" data-id="${esc(p.per_codper)}" title="Quitar fecha de baja">Reactivar</button>`
                : `<button type="button" class="linkish danger" data-act="baja-per" data-id="${esc(p.per_codper)}" title="Baja lógica">Baja</button>`
            }
            <button type="button" class="linkish danger" data-act="del-per" data-id="${esc(p.per_codper)}" title="Eliminar de la base de datos">Borrado</button>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const p = state.permisos.find((x) => x.per_codper === id);
        try {
          if (btn.dataset.act === "edit-per") openPermisoModal(p);
          if (btn.dataset.act === "baja-per") {
            const ok1 = await askConfirm(
              `¿Estás seguro de dar de baja este registro?\n\nPermiso: ${id}`,
              "Baja"
            );
            if (!ok1) return;
            const ok2 = await askConfirm(
              "Si pulsas Sí, el permiso quedará de baja. Podrás reactivarlo después.\n\n¿Confirmas la baja?",
              "Confirmar baja"
            );
            if (!ok2) return;
            await api(`/api/permisos/${encodeURIComponent(id)}`, { method: "DELETE" });
            toast(`Permiso ${id} dado de baja`);
            await loadPermisos();
          }
          if (btn.dataset.act === "react-per") {
            const ok = await askConfirm(`¿Reactivar el permiso ${id}?`, "Reactivar");
            if (!ok) return;
            await api(`/api/permisos/${encodeURIComponent(id)}/reactivar`, { method: "POST" });
            toast(`Permiso ${id} reactivado`);
            await loadPermisos();
          }
          if (btn.dataset.act === "del-per") {
            const ok = await confirmBorrarRegistro(`Permiso: ${id}`);
            if (!ok) return;
            await api(`/api/permisos/${encodeURIComponent(id)}/permanente`, { method: "DELETE" });
            toast(`Permiso ${id} eliminado de la base de datos`);
            await loadPermisos();
          }
        } catch (err) {
          toast(err.message, "err");
        }
      });
    });
  }

  function openPermisoModal(existing) {
    const isEdit = Boolean(existing);
    openModal(isEdit ? "Editar permiso" : "Nuevo permiso", [
      field("per_codper", "Código", existing?.per_codper || "", { required: true, disabled: isEdit, maxlength: 20 }),
      field("per_nomper", "Nombre", existing?.per_nomper || "", { required: true, maxlength: 100 }),
    ], async (data) => {
      if (isEdit) {
        await api(`/api/permisos/${encodeURIComponent(existing.per_codper)}`, {
          method: "PUT",
          body: JSON.stringify({
            per_codper: existing.per_codper,
            per_nomper: data.per_nomper,
          }),
        });
        toast("Permiso actualizado");
      } else {
        await api("/api/permisos", {
          method: "POST",
          body: JSON.stringify({
            per_codper: data.per_codper,
            per_nomper: data.per_nomper,
            per_usrcre: usuario.usr_codusr,
          }),
        });
        toast("Permiso creado");
      }
      await loadPermisos();
    });
  }

  // -------- Asignaciones --------
  async function loadAsignaciones() {
    state.asignaciones = await api("/api/permisos-usuario");
    renderAsignaciones();
  }

  function renderAsignaciones() {
    const tbody = document.querySelector("#tabla-asignaciones tbody");
    const rows = state.asignaciones.filter((a) =>
      matchSearch(a, [a.peu_codusr, a.peu_codper, a.peu_usrcre, String(a.peu_codpeu)])
    );
    document.getElementById("count-asignaciones").textContent = String(rows.length);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No hay asignaciones</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map((a) => {
        const baja = Boolean(a.peu_fecbaj);
        return `<tr>
          <td>${a.peu_codpeu}</td>
          <td><strong>${esc(a.peu_codusr)}</strong></td>
          <td>${esc(a.peu_codper)}</td>
          <td>${esc(fmtDate(a.peu_feccre))}</td>
          <td>${esc(a.peu_usrcre || "—")}</td>
          <td>${baja ? '<span class="badge off">Baja</span>' : '<span class="badge ok">Activo</span>'}</td>
          <td class="row-actions">
            ${
              baja
                ? `<button type="button" class="linkish" data-act="react-asig" data-id="${a.peu_codpeu}" title="Quitar fecha de baja">Reactivar</button>`
                : `<button type="button" class="linkish danger" data-act="baja-asig" data-id="${a.peu_codpeu}" title="Baja lógica">Baja</button>`
            }
            <button type="button" class="linkish danger" data-act="del-asig" data-id="${a.peu_codpeu}" title="Eliminar de la base de datos">Borrado</button>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        try {
          if (btn.dataset.act === "baja-asig") {
            const ok1 = await askConfirm(
              `¿Estás seguro de dar de baja este registro?\n\nAsignación #${id}`,
              "Baja"
            );
            if (!ok1) return;
            const ok2 = await askConfirm(
              "Si pulsas Sí, la asignación quedará de baja. Podrás reactivarla después.\n\n¿Confirmas la baja?",
              "Confirmar baja"
            );
            if (!ok2) return;
            await api(`/api/permisos-usuario/${id}`, { method: "DELETE" });
            toast(`Asignación #${id} dada de baja`);
            await loadAsignaciones();
          }
          if (btn.dataset.act === "react-asig") {
            const ok = await askConfirm(`¿Reactivar la asignación #${id}?`, "Reactivar");
            if (!ok) return;
            await api(`/api/permisos-usuario/${id}/reactivar`, { method: "POST" });
            toast(`Asignación #${id} reactivada`);
            await loadAsignaciones();
          }
          if (btn.dataset.act === "del-asig") {
            const ok = await confirmBorrarRegistro(`Asignación #${id}`);
            if (!ok) return;
            await api(`/api/permisos-usuario/${id}/permanente`, { method: "DELETE" });
            toast(`Asignación #${id} eliminada de la base de datos`);
            await loadAsignaciones();
          }
        } catch (err) {
          toast(err.message, "err");
        }
      });
    });
  }

  function openAsignacionModal() {
    const userOpts = state.usuarios
      .filter((u) => !u.usr_fecbaj)
      .map((u) => ({ value: u.usr_codusr, label: `${u.usr_codusr} — ${u.usr_name}` }));
    const perOpts = state.permisos
      .filter((p) => !p.per_fecbaj)
      .filter((p) => isSuperAdmin || p.per_codper !== "SUPERADMIN")
      .map((p) => ({
        value: p.per_codper,
        label: `${p.per_codper} — ${p.per_nomper}`,
      }));
    openModal("Asignar permiso", [
      selectField("peu_codusr", "Usuario", userOpts, { required: true }),
      selectField("peu_codper", "Permiso", perOpts, { required: true }),
    ], async (data) => {
      await api("/api/permisos-usuario", {
        method: "POST",
        body: JSON.stringify({
          peu_codusr: data.peu_codusr,
          peu_codper: data.peu_codper,
          peu_usrcre: usuario.usr_codusr,
        }),
      });
      toast("Permiso asignado");
      await loadAsignaciones();
    });
  }

  // -------- Eventos --------
  async function loadCentros() {
    state.centros = await api("/api/centros");
  }

  async function loadEventos() {
    state.eventos = await api("/api/eventos?limit=500");
    renderEventos();
  }

  function fmtEventoFecha(iso) {
    if (!iso) return "—";
    const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function renderEventos() {
    const tbody = document.querySelector("#tabla-eventos tbody");
    const rows = state.eventos.filter((e) =>
      matchSearch(e, [
        e.exi_eveide,
        e.exi_feceve,
        e.exi_nomeve,
        e.exi_codcen,
        e.exi_nomcen,
        e.eve_neccir ? "sí" : "no",
        e.eve_neccir ? "circular" : "",
      ])
    );
    document.getElementById("count-eventos").textContent = String(rows.length);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No hay eventos</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map(
        (e) => `<tr>
          <td><strong>#${esc(e.exi_eveide)}</strong></td>
          <td>${esc(fmtEventoFecha(e.exi_feceve))}</td>
          <td>${esc(e.exi_nomeve)}</td>
          <td><strong>${esc(e.exi_codcen)}</strong> ${esc(e.exi_nomcen || "")}</td>
          <td>${e.eve_neccir ? '<span class="badge ok">Sí</span>' : '<span class="badge off">No</span>'}</td>
          <td class="row-actions">
            <button type="button" class="linkish" data-act="edit-eve" data-id="${e.exi_eveide}">Editar</button>
            <button type="button" class="linkish danger" data-act="del-eve" data-id="${e.exi_eveide}" title="Eliminar de la base de datos">Borrado</button>
          </td>
        </tr>`
      )
      .join("");

    tbody.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        const eve = state.eventos.find((x) => x.exi_eveide === id);
        try {
          if (btn.dataset.act === "edit-eve") openEventoModal(eve);
          if (btn.dataset.act === "del-eve") {
            const ok = await confirmBorrarRegistro(
              `Evento #${id}: ${eve?.exi_nomeve || ""}`
            );
            if (!ok) return;
            await api(`/api/eventos/${id}`, { method: "DELETE" });
            toast(`Evento #${id} eliminado`);
            await loadEventos();
          }
        } catch (err) {
          toast(err.message, "err");
        }
      });
    });
  }

  function openEventoModal(existing) {
    const isEdit = Boolean(existing);
    const cenOpts = (state.centros || [])
      .filter((c) => !c.exi_fecbaj)
      .map((c) => ({
        value: c.exi_codcen,
        label: `${c.exi_codcen} — ${c.exi_nomcen || ""}`,
      }));
    if (!cenOpts.length) {
      toast("No hay centros disponibles. Crea uno en General primero.", "err");
      return;
    }
    openModal(isEdit ? "Editar evento" : "Nuevo evento", [
      field("exi_feceve", "Fecha", existing?.exi_feceve || isoDate(new Date()), {
        type: "date",
        required: true,
      }),
      field("exi_nomeve", "Nombre", existing?.exi_nomeve || "", {
        required: true,
        maxlength: 200,
        placeholder: "Ej. salida a KATMANDU",
      }),
      selectField("exi_codcen", "Centro", cenOpts, {
        required: true,
        value: existing?.exi_codcen || cenOpts[0].value,
      }),
      checkboxField("eve_neccir", "Necesita circular", Boolean(existing?.eve_neccir)),
    ], async (data) => {
      const body = {
        exi_feceve: data.exi_feceve,
        exi_nomeve: String(data.exi_nomeve || "").trim(),
        exi_codcen: data.exi_codcen,
        eve_neccir: Boolean(data.eve_neccir),
      };
      if (!body.exi_nomeve) throw new Error("El nombre del evento es obligatorio");
      if (isEdit) {
        await api(`/api/eventos/${existing.exi_eveide}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        toast("Evento actualizado");
      } else {
        await api("/api/eventos", {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast("Evento creado");
      }
      await loadEventos();
    });
  }

  // -------- Logs --------
  function fillLogUserSelect() {
    const current = els.logUsuario.value;
    els.logUsuario.innerHTML =
      `<option value="">Todos</option>` +
      state.usuarios
        .map((u) => `<option value="${esc(u.usr_codusr)}">${esc(u.usr_codusr)} — ${esc(u.usr_name)}</option>`)
        .join("");
    els.logUsuario.value = current;
  }

  async function loadLogs() {
    const params = new URLSearchParams();
    const desde =
      typeof ExiDates !== "undefined" ? ExiDates.toIsoDate(els.logDesde.value) : els.logDesde.value;
    const hasta =
      typeof ExiDates !== "undefined" ? ExiDates.toIsoDate(els.logHasta.value) : els.logHasta.value;
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (els.logUsuario.value) params.set("codusr", els.logUsuario.value);

    const qs = params.toString();
    const [resumen, logs] = await Promise.all([
      api(`/api/logins/resumen?${qs}`),
      api(`/api/logins?${qs}&limit=1000`),
    ]);
    state.resumen = resumen;
    state.logs = logs;
    const withData = (resumen.dias || []).filter((d) => d.total > 0);
    state.selectedDia = withData.length ? withData[withData.length - 1].fecha : null;
    renderLogs();
  }

  function renderLogs() {
    const resumen = state.resumen || { dias: [], total: 0 };
    document.getElementById("count-logs-total").textContent = String(resumen.total || 0);

    const max = Math.max(1, ...resumen.dias.map((d) => d.total));
    const avg =
      resumen.dias.length > 0
        ? resumen.dias.reduce((s, d) => s + d.total, 0) / resumen.dias.length
        : 0;

    const diasEl = document.getElementById("logs-dias");
    if (!resumen.dias.length) {
      diasEl.innerHTML = `<p class="empty-state">Sin datos en el rango</p>`;
    } else {
      diasEl.innerHTML = resumen.dias
        .map((d) => {
          const pct = Math.round((d.total / max) * 100);
          const anomaly = d.total > avg * 2 && d.total >= 3;
          return `<button type="button" class="dia-row ${d.fecha === state.selectedDia ? "active" : ""} ${anomaly ? "anomaly" : ""}" data-dia="${d.fecha}">
            <span>${fmtDay(d.fecha)}</span>
            <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
            <span class="dia-total">${d.total}</span>
          </button>`;
        })
        .join("");
      diasEl.querySelectorAll("[data-dia]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.selectedDia = btn.dataset.dia;
          renderLogs();
        });
      });
    }

    const dia = resumen.dias.find((d) => d.fecha === state.selectedDia);
    document.getElementById("logs-dia-sel").textContent = dia
      ? `${fmtDay(dia.fecha)} · ${dia.total} acceso(s)`
      : "Selecciona un día";

    const horasEl = document.getElementById("logs-horas");
    const porHora = dia ? dia.por_hora : Array.from({ length: 24 }, (_, hora) => ({ hora, total: 0 }));
    const maxH = Math.max(1, ...porHora.map((h) => h.total));
    horasEl.innerHTML = porHora
      .map((h) => {
        let cls = "hour-cell";
        if (h.total === 0) cls += " empty";
        else if (h.total >= maxH * 0.7 && h.total >= 2) cls += " hot";
        else if (h.total > 0) cls += " mid";
        return `<div class="${cls}" title="${h.hora}:00 — ${h.total}">
          <span>${String(h.hora).padStart(2, "0")}h</span>
          <strong>${h.total}</strong>
        </div>`;
      })
      .join("");

    const tbody = document.querySelector("#tabla-logs tbody");
    let rows = state.logs;
    if (state.selectedDia) {
      rows = rows.filter((l) => String(l.log_feclog).startsWith(state.selectedDia));
    }
    rows = rows.filter((l) =>
      matchSearch(l, [l.log_codusr, l.log_ip, l.log_dispos, String(l.log_logid)])
    );
    document.getElementById("count-logs").textContent = String(rows.length);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Sin entradas</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map(
        (l) => `<tr>
          <td>${l.log_logid}</td>
          <td><strong>${esc(l.log_codusr)}</strong></td>
          <td>${esc(fmtDate(l.log_feclog))}</td>
          <td>${esc(l.log_ip || "—")}</td>
          <td title="${esc(l.log_dispos || "")}">${esc(short(l.log_dispos || "—", 48))}</td>
        </tr>`
      )
      .join("");
  }

  // -------- Modal helpers --------
  function field(name, label, value, opts = {}) {
    if (opts.type === "date") {
      const iso = typeof ExiDates !== "undefined" ? ExiDates.toIsoDate(value) : String(value || "").slice(0, 10);
      const attrs = [
        `name="${name}"`,
        `id="f-${name}"`,
        'type="text"',
        'class="exi-date"',
        'inputmode="numeric"',
        'autocomplete="off"',
        'placeholder="dd/mm/aaaa"',
        opts.required ? "required" : "",
        opts.disabled ? "disabled" : "",
        `value="${esc(iso)}"`,
      ]
        .filter(Boolean)
        .join(" ");
      return `<label for="f-${name}">${label}</label><input ${attrs} />`;
    }
    const attrs = [
      `name="${name}"`,
      `id="f-${name}"`,
      opts.required ? "required" : "",
      opts.disabled ? "disabled" : "",
      opts.type ? `type="${opts.type}"` : 'type="text"',
      opts.maxlength ? `maxlength="${opts.maxlength}"` : "",
      opts.placeholder ? `placeholder="${esc(opts.placeholder)}"` : "",
      `value="${esc(value)}"`,
    ]
      .filter(Boolean)
      .join(" ");
    return `<label for="f-${name}">${label}</label><input ${attrs} />`;
  }

  function selectField(name, label, options, opts = {}) {
    const optsHtml = options
      .map((o) => {
        const sel = String(o.value) === String(opts.value ?? "") ? " selected" : "";
        return `<option value="${esc(o.value)}"${sel}>${esc(o.label)}</option>`;
      })
      .join("");
    return `<label for="f-${name}">${label}</label>
      <select name="${name}" id="f-${name}" ${opts.required ? "required" : ""} ${opts.disabled ? "disabled" : ""}>${optsHtml}</select>`;
  }

  function checkboxField(name, label, checked = false) {
    return `<label class="check-label" for="f-${name}">
      <input type="checkbox" name="${name}" id="f-${name}" value="1" ${checked ? "checked" : ""} />
      <span>${esc(label)}</span>
    </label>`;
  }

  function openModal(title, fieldsHtml, onSubmit) {
    if (typeof ExiDates !== "undefined") ExiDates.destroy(els.modalForm);
    els.modalTitle.textContent = title;
    els.modalForm.innerHTML = fieldsHtml.join("");
    els.modalMsg.textContent = "";
    els.modalMsg.className = "message";
    els.modal.classList.remove("hidden");
    if (typeof ExiDates !== "undefined") ExiDates.bind(els.modalForm);

    els.modalForm.onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(els.modalForm);
      const data = Object.fromEntries(fd.entries());
      // incluir disabled
      els.modalForm.querySelectorAll("[disabled][name]").forEach((el) => {
        data[el.name] = el.value;
      });
      els.modalForm.querySelectorAll('input[type="checkbox"][name]').forEach((el) => {
        data[el.name] = el.checked;
      });
      els.modalForm.querySelectorAll("input.exi-date[name]").forEach((el) => {
        data[el.name] =
          typeof ExiDates !== "undefined" ? ExiDates.toIsoDate(el.value) : el.value;
      });
      const submitBtn = document.getElementById("modal-submit");
      submitBtn.disabled = true;
      try {
        await onSubmit(data);
        closeModal();
      } catch (err) {
        els.modalMsg.textContent = err.message;
        els.modalMsg.className = "message err";
      } finally {
        submitBtn.disabled = false;
      }
    };
  }

  function closeModal() {
    if (typeof ExiDates !== "undefined") ExiDates.destroy(els.modalForm);
    els.modal.classList.add("hidden");
    els.modalForm.onsubmit = null;
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function short(text, n) {
    return text.length > n ? `${text.slice(0, n)}…` : text;
  }

  // -------- SQL --------
  state.sqlResult = { columns: [], rows: [], row_count: 0, truncated: false };

  async function runSql() {
    const editor = document.getElementById("sql-editor");
    const sql = (editor.value || "").trim();
    if (!sql) {
      toast("Escribe una consulta SQL", "err");
      return;
    }
    const btn = document.getElementById("btn-sql-run");
    btn.disabled = true;
    try {
      state.sqlResult = await api("/api/sql/query", {
        method: "POST",
        body: JSON.stringify({ sql }),
      });
      renderSqlResult();
      const extra = state.sqlResult.truncated ? " (recortado a 1000 filas)" : "";
      toast(`Consulta OK: ${state.sqlResult.row_count} fila(s)${extra}`);
    } catch (err) {
      toast(err.message, "err");
    } finally {
      btn.disabled = false;
    }
  }

  function renderSqlResult() {
    const thead = document.querySelector("#tabla-sql thead");
    const tbody = document.querySelector("#tabla-sql tbody");
    const meta = document.getElementById("sql-meta");
    const res = state.sqlResult || { columns: [], rows: [], row_count: 0, truncated: false };
    const cols = res.columns || [];
    let rows = res.rows || [];

    if (state.search && cols.length) {
      rows = rows.filter((row) =>
        row.some((cell) => String(cell ?? "").toLowerCase().includes(state.search))
      );
    }

    document.getElementById("count-sql").textContent = String(rows.length);
    meta.textContent = res.truncated
      ? `Mostrando ${rows.length} de ${res.row_count}+ (máx. 1000)`
      : rows.length
        ? `${rows.length} fila(s)`
        : "";

    if (!cols.length) {
      thead.innerHTML = "";
      tbody.innerHTML = `<tr><td class="empty-state">Ejecuta una consulta para ver el resultado</td></tr>`;
      return;
    }

    thead.innerHTML = `<tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>`;
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${cols.length}" class="empty-state">Sin filas</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map(
        (row) =>
          `<tr>${row
            .map((cell) => `<td>${esc(cell == null ? "—" : cell)}</td>`)
            .join("")}</tr>`
      )
      .join("");
  }

  document.getElementById("btn-sql-run").addEventListener("click", () => runSql());
  document.getElementById("btn-sql-clear").addEventListener("click", () => {
    document.getElementById("sql-editor").value = "";
    state.sqlResult = { columns: [], rows: [], row_count: 0, truncated: false };
    renderSqlResult();
  });
  document.querySelectorAll(".sql-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("sql-editor").value = btn.dataset.sql || "";
      document.getElementById("sql-editor").focus();
    });
  });
  document.getElementById("sql-editor").addEventListener("keydown", (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
      ev.preventDefault();
      runSql();
    }
  });

  // boot
  switchSection(state.section);
  Promise.all([
    loadUsuarios(),
    loadPermisos(),
    loadAsignaciones(),
    loadCentros(),
    loadEventos(),
    loadLogs(),
  ]).catch((err) => {
    toast(err.message, "err");
  });
})();
