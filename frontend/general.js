(() => {
  const sessionRaw = localStorage.getItem(SESSION_KEY);
  if (!sessionRaw) {
    window.location.href = "/";
    return;
  }

  const session = JSON.parse(sessionRaw);
  const usuario = session.usuario || {};
  const permisos = Array.isArray(session.permisos) ? session.permisos : [];
  const isAdmin = permisos.includes("SUPERADMIN") || permisos.includes("ADMIN");
  const isGeneral = permisos.includes("GENERAL") || isAdmin;

  if (!isGeneral) {
    window.location.href = "/home";
    return;
  }

  const state = {
    section: "periodos",
    periodos: [],
    ninosPeriodo: [],
    monitoresPeriodo: [],
    centros: [],
    monitores: [],
    ninos: [],
    ninosCent: [],
    monitoresCent: [],
    gruposMonitores: [],
    tiposGrupo: [],
    tiposGruposCentro: [],
    gruposCentro: [],
    descuentos: [],
    precios: [],
    filtroCentroMon: "",
    filtroCentroNic: "",
    filtroCentroMoc: "",
    filtroCentroTgc: "",
    filtroPeriodoNic: "",
    filtroPeriodoMoc: "",
    buscaNicDisp: "",
    buscaMocDisp: "",
    soloSinGrupo: false,
    verTodosMonCen: false,
    verTodosTgc: false,
    search: "",
  };

  const TIPOS_MONITOR = [
    { value: "", label: "— Seleccionar —" },
    { value: "INTERNO", label: "INTERNO" },
    { value: "BECARIO", label: "BECARIO" },
  ];

  function tipMonitorBadge(tip) {
    const t = String(tip || "").trim().toUpperCase();
    if (t === "INTERNO") return `<span class="badge ok" title="Monitor interno">INTERNO</span>`;
    if (t === "BECARIO") return `<span class="badge nic-tipo" title="Monitor becario">BECARIO</span>`;
    return tip ? esc(tip) : "—";
  }

  const els = {
    userLabel: document.getElementById("user-label"),
    search: document.getElementById("global-search"),
    pillRow: document.getElementById("pill-row"),
    toast: document.getElementById("toast"),
    modal: document.getElementById("modal"),
    modalTitle: document.getElementById("modal-title"),
    modalForm: document.getElementById("modal-form"),
    modalMsg: document.getElementById("modal-msg"),
  };

  els.userLabel.textContent = `${usuario.usr_name || ""} (${usuario.usr_codusr || ""})`;

  document.getElementById("btn-logout").addEventListener("click", () => {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "/";
  });

  if (isAdmin) {
    const menuAdmin = document.getElementById("menu-admin");
    menuAdmin.classList.remove("hidden");
    setupSideFlyout({
      group: menuAdmin,
      button: document.getElementById("btn-menu-admin"),
      flyout: document.getElementById("flyout-admin"),
    });
  }

  setupSideFlyout({
    group: document.getElementById("menu-general"),
    button: document.getElementById("btn-menu-general"),
    flyout: document.getElementById("flyout-general"),
    onSelect: (section) => {
      if (section) switchSection(section);
    },
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

  els.search.addEventListener("input", () => {
    state.search = els.search.value.trim().toLowerCase();
    if (state.section === "ninos-centro") {
      state.buscaNicDisp = state.search;
      const poolSearch = document.getElementById("busca-nic-disp");
      if (poolSearch) poolSearch.value = els.search.value;
      renderNinosCentroBoard();
      return;
    }
    if (state.section === "monitores-grupos") {
      state.buscaMocDisp = state.search;
      const poolSearch = document.getElementById("busca-moc-disp");
      if (poolSearch) poolSearch.value = els.search.value;
      renderMonitoresGruposBoard();
      return;
    }
    renderActive();
  });

  document.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  const SECTIONS = [
    "periodos",
    "centros",
    "monitores",
    "monitores-centro",
    "monitores-grupos",
    "ninos",
    "ninos-centro",
    "ninos-periodos",
    "monitores-periodos",
    "tipos-grupo",
    "grupos-centro",
    "descuentos",
    "precios",
  ];

  const hashSection = (location.hash || "").replace("#", "");
  if (hashSection === "ninos-asistencia") {
    window.location.href = "/asistencia#ninos-asistencia";
    return;
  }
  if (SECTIONS.includes(hashSection)) state.section = hashSection;

  window.addEventListener("hashchange", () => {
    const sec = (location.hash || "").replace("#", "");
    if (SECTIONS.includes(sec) && sec !== state.section) switchSection(sec);
  });

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

  function fmtDate(value) {
    if (!value) return "—";
    return new Date(value).toLocaleString("es-ES");
  }

  function fmtDateOnly(value) {
    if (!value) return "—";
    const s = String(value).slice(0, 10);
    const [y, m, d] = s.split("-");
    if (!y || !m || !d) return s;
    return `${d}/${m}/${y}`;
  }

  function toInputDate(value) {
    if (!value) return "";
    return String(value).slice(0, 10);
  }

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

  async function confirmBorrarRegistro(detalle) {
    const paso1 = await askConfirm(
      `¿Estás seguro de borrar este registro?\n\n${detalle}`,
      "Borrar registro"
    );
    if (!paso1) return false;
    return askConfirm(
      "Si pulsas Sí, el registro se eliminará de la base de datos y no se podrá recuperar.\n\n¿Confirmas el borrado?",
      "Confirmar borrado"
    );
  }

  function matchSearch(fields) {
    if (!state.search) return true;
    return fields.some((f) => String(f ?? "").toLowerCase().includes(state.search));
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function numOrNull(v) {
    if (v === "" || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function switchSection(name) {
    if (!SECTIONS.includes(name)) name = "periodos";
    state.section = name;
    history.replaceState(null, "", `#${name}`);
    document.querySelectorAll("#flyout-general .flyout-link[data-section]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.section === name);
    });
    document.querySelectorAll(".admin-section").forEach((sec) => {
      const show = sec.dataset.section === name;
      sec.classList.toggle("hidden", !show);
    });
    const placeholders = {
      periodos: "Buscar periodos…",
      centros: "Buscar centros…",
      monitores: "Buscar monitores…",
      "monitores-centro": "Buscar monitores del centro…",
      "monitores-grupos": "Filtra monitores disponibles…",
      ninos: "Buscar niños…",
      "ninos-centro": "Filtra niños disponibles…",
      "ninos-periodos": "Buscar niño en la matriz…",
      "monitores-periodos": "Buscar monitor en la matriz…",
      "tipos-grupo": "Buscar tipos de grupo…",
      "grupos-centro": "Buscar grupos del centro…",
      descuentos: "Buscar descuentos…",
      precios: "Buscar precios…",
    };
    els.search.placeholder = placeholders[name] || "Buscar…";
    els.search.value = "";
    state.search = "";
    if (name === "monitores-centro") fillFiltroCentros();
    if (name === "grupos-centro") {
      fillFiltroCentrosTgc();
      loadTiposGruposCentro().catch((err) => toast(err.message, "err"));
    }
    if (name === "ninos-centro") {
      fillFiltroCentrosNic();
      ensureNinosBoard().catch((err) => toast(err.message, "err"));
    }
    if (name === "monitores-grupos") {
      fillFiltroCentrosMoc();
      ensureMonitoresGruposBoard().catch((err) => toast(err.message, "err"));
    }
    if (name === "ninos" && !state.ninos.length) {
      loadNinos().catch((err) => toast(err.message, "err"));
    }
    if (name === "tipos-grupo") {
      loadTiposGrupo().catch((err) => toast(err.message, "err"));
    }
    if (name === "descuentos") {
      loadDescuentos().catch((err) => toast(err.message, "err"));
    }
    if (name === "precios") {
      loadPrecios().catch((err) => toast(err.message, "err"));
    }
    if (name === "periodos") {
      loadPeriodos().catch((err) => toast(err.message, "err"));
    }
    if (name === "ninos-periodos") {
      ensureNinosPeriodos().catch((err) => toast(err.message, "err"));
    }
    if (name === "monitores-periodos") {
      ensureMonitoresPeriodos().catch((err) => toast(err.message, "err"));
    }
    renderPills();
    renderActive();
  }

  function renderPills() {
    const map = {
      periodos: [
        { label: "Nuevo periodo", action: () => openPeriodoModal() },
        { label: "Actualizar", action: () => loadPeriodos().then(() => toast("Periodos actualizados")) },
        { label: "Descargar", action: () => downloadTableCsv("#tabla-periodos", "exi_periodos"), download: true },
      ],
      centros: [
        { label: "Nuevo centro", action: () => openCentroModal() },
        { label: "Actualizar", action: () => loadCentros().then(() => toast("Centros actualizados")) },
        { label: "Descargar", action: () => downloadTableCsv("#tabla-centros", "exi_centros"), download: true },
        { label: "Ver mapa", action: () => openMapaCentros(), map: true },
      ],
      monitores: [
        { label: "Nuevo monitor", action: () => openMonitorModal() },
        { label: "Actualizar", action: () => loadMonitores().then(() => toast("Monitores actualizados")) },
        { label: "Descargar", action: () => downloadTableCsv("#tabla-monitores", "exi_monitores"), download: true },
      ],
      "monitores-centro": [
        {
          label: "Nuevo monitor",
          action: () => {
            if (!state.filtroCentroMon && !state.verTodosMonCen) {
              toast("Selecciona un centro primero", "err");
              return;
            }
            openMonitorModal(null, state.filtroCentroMon ? { fixedCodcen: state.filtroCentroMon } : {});
          },
        },
        {
          label: "Actualizar",
          action: () => loadMonitores().then(() => toast("Monitores actualizados")),
        },
      ],
      ninos: [
        { label: "Nuevo niño", action: () => openNinoModal() },
        { label: "Actualizar", action: () => loadNinos().then(() => toast("Niños actualizados")) },
        { label: "Descargar", action: () => downloadTableCsv("#tabla-ninos", "exi_ninos"), download: true },
      ],
      "ninos-centro": [
        {
          label: "Actualizar",
          action: () =>
            ensureNinosBoard(true)
              .then(() => toast("Tablero actualizado"))
              .catch((err) => toast(err.message, "err")),
        },
      ],
      "ninos-periodos": [
        {
          label: "Actualizar",
          action: () =>
            ensureNinosPeriodos(true)
              .then(() => toast("Asistencia actualizada"))
              .catch((err) => toast(err.message, "err")),
        },
        {
          label: "Descargar",
          download: true,
          action: () => exportNinosPeriodos("csv"),
        },
        {
          label: "Informe PDF",
          pdf: true,
          action: () => exportNinosPeriodos("pdf"),
        },
      ],
      "monitores-periodos": [
        {
          label: "Actualizar",
          action: () =>
            ensureMonitoresPeriodos(true)
              .then(() => toast("Asistencia actualizada"))
              .catch((err) => toast(err.message, "err")),
        },
        {
          label: "Descargar",
          download: true,
          action: () => exportMonitoresPeriodos("csv"),
        },
        {
          label: "Informe PDF",
          pdf: true,
          action: () => exportMonitoresPeriodos("pdf"),
        },
      ],
      "monitores-grupos": [
        {
          label: "Actualizar",
          action: () =>
            ensureMonitoresGruposBoard(true)
              .then(() => toast("Tablero actualizado"))
              .catch((err) => toast(err.message, "err")),
        },
      ],
      "tipos-grupo": [
        { label: "Nuevo tipo", action: () => openTipoGrupoModal() },
        { label: "Actualizar", action: () => loadTiposGrupo().then(() => toast("Tipos actualizados")) },
        { label: "Descargar", action: () => downloadTableCsv("#tabla-tipos-grupo", "exi_tipo_grupo"), download: true },
      ],
      descuentos: [
        { label: "Nuevo descuento", action: () => openDescuentoModal() },
        { label: "Actualizar", action: () => loadDescuentos().then(() => toast("Descuentos actualizados")) },
        { label: "Descargar", action: () => downloadTableCsv("#tabla-descuentos", "exi_descuentos"), download: true },
      ],
      precios: [
        { label: "Nuevo precio", action: () => openPrecioModal() },
        { label: "Actualizar", action: () => loadPrecios().then(() => toast("Precios actualizados")) },
        { label: "Descargar", action: () => downloadTableCsv("#tabla-precios", "exi_precios"), download: true },
      ],
      "grupos-centro": [
        {
          label: "Asociar grupo",
          action: () => {
            if (!state.filtroCentroTgc && !state.verTodosTgc) {
              toast("Selecciona un centro primero", "err");
              return;
            }
            openTipoGrupoCentroModal(null, state.filtroCentroTgc ? { fixedCodcen: state.filtroCentroTgc } : {});
          },
        },
        {
          label: "Actualizar",
          action: () => loadTiposGruposCentro().then(() => toast("Grupos del centro actualizados")),
        },
      ],
    };
    els.pillRow.innerHTML = "";
    (map[state.section] || []).forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = item.download || item.pdf || item.map ? "pill-btn solid" : "pill-btn ghost";
      if (item.download) {
        btn.title = "Descargar el grid visible (CSV)";
        btn.innerHTML = `<span class="pill-ico" aria-hidden="true">⬇</span> Descargar`;
      } else if (item.pdf) {
        btn.title = "Descargar informe PDF";
        btn.innerHTML = `<span class="pill-ico" aria-hidden="true">⬇</span> Informe PDF`;
      } else if (item.map) {
        btn.title = "Ver todos los centros en el mapa";
        btn.innerHTML = `<span class="pill-ico" aria-hidden="true">⌖</span> Ver mapa`;
      } else {
        btn.textContent = item.label;
      }
      btn.addEventListener("click", item.action);
      els.pillRow.appendChild(btn);
    });
  }

  function renderActive() {
    if (state.section === "periodos") renderPeriodos();
    if (state.section === "centros") renderCentros();
    if (state.section === "monitores") renderMonitores();
    if (state.section === "monitores-centro") renderMonitoresCentro();
    if (state.section === "ninos") renderNinos();
    if (state.section === "ninos-centro") renderNinosCentroBoard();
    if (state.section === "ninos-periodos") renderNinosPeriodos();
    if (state.section === "monitores-periodos") renderMonitoresPeriodos();
    if (state.section === "monitores-grupos") renderMonitoresGruposBoard();
    if (state.section === "tipos-grupo") renderTiposGrupo();
    if (state.section === "grupos-centro") renderTiposGruposCentro();
    if (state.section === "descuentos") renderDescuentos();
    if (state.section === "precios") renderPrecios();
  }

  async function loadPeriodos() {
    state.periodos = await api("/api/periodos");
    renderPeriodos();
    if (state.section === "ninos-periodos") renderNinosPeriodos();
    if (state.section === "monitores-periodos") renderMonitoresPeriodos();
  }

  function isPeriodoActivo(p) {
    return String(p?.per_status || "") === "Activo";
  }

  function isPeriodoVigente(p) {
    const hoy = new Date();
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const ini = new Date(`${String(p.per_fecini).slice(0, 10)}T12:00:00`);
    const fin = new Date(`${String(p.per_fecfin).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime())) return false;
    return ini <= d && d <= fin;
  }

  function renderPeriodos() {
    const tbody = document.querySelector("#tabla-periodos tbody");
    if (!tbody) return;
    const rows = state.periodos.filter((p) =>
      matchSearch([
        p.per_codper,
        p.per_fecini,
        p.per_fecfin,
        p.per_status,
        fmtDateOnly(p.per_fecini),
        fmtDateOnly(p.per_fecfin),
      ])
    );
    document.getElementById("count-periodos").textContent = String(rows.length);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No hay periodos</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map((p) => {
        const vigente = isPeriodoVigente(p);
        const activo = isPeriodoActivo(p);
        return `<tr>
          <td><strong>${esc(p.per_codper)}</strong>${
            vigente ? ' <span class="badge ok">Vigente</span>' : ""
          }</td>
          <td>${esc(fmtDateOnly(p.per_fecini))}</td>
          <td>${esc(fmtDateOnly(p.per_fecfin))}</td>
          <td>${
            activo
              ? '<span class="badge ok">Activo</span>'
              : '<span class="badge off">No Activo</span>'
          }</td>
          <td class="row-actions">
            <button type="button" class="linkish" data-act="edit-per" data-id="${esc(p.per_codper)}">Editar</button>
            <button type="button" class="linkish danger" data-act="del-per" data-id="${esc(p.per_codper)}">Borrado</button>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const p = state.periodos.find((x) => x.per_codper === id);
        try {
          if (btn.dataset.act === "edit-per") openPeriodoModal(p);
          if (btn.dataset.act === "del-per") {
            const ok = await confirmBorrarRegistro(`Periodo: ${id}`);
            if (!ok) return;
            await api(`/api/periodos/${encodeURIComponent(id)}`, { method: "DELETE" });
            toast(`Periodo ${id} eliminado`);
            await loadPeriodos();
          }
        } catch (err) {
          toast(err.message, "err");
        }
      });
    });
  }

  function openPeriodoModal(existing) {
    const isEdit = Boolean(existing);
    const statusOpts = [
      { value: "Activo", label: "Activo" },
      { value: "No Activo", label: "No Activo" },
    ];
    openModal(
      isEdit ? "Editar periodo" : "Nuevo periodo",
      [
        field("per_codper", "Código", existing?.per_codper || "", {
          required: true,
          disabled: isEdit,
          maxlength: 10,
          placeholder: "Ej. P1-2026",
          span: isEdit ? 1 : 1,
        }),
        field("per_fecini", "Fecha inicio", toInputDate(existing?.per_fecini), {
          type: "date",
          required: true,
        }),
        field("per_fecfin", "Fecha fin", toInputDate(existing?.per_fecfin), {
          type: "date",
          required: true,
        }),
        selectField("per_status", "Estado", statusOpts, {
          required: true,
          value: existing?.per_status || "Activo",
        }),
      ],
      async (data) => {
        const body = {
          per_codper: String(data.per_codper || "").trim().toUpperCase(),
          per_fecini: data.per_fecini,
          per_fecfin: data.per_fecfin,
          per_status: String(data.per_status || "Activo").trim(),
        };
        if (!body.per_codper) throw new Error("El código del periodo es obligatorio");
        if (!body.per_fecini || !body.per_fecfin) throw new Error("Las fechas son obligatorias");
        if (body.per_fecfin < body.per_fecini) {
          throw new Error("La fecha de fin debe ser igual o posterior a la de inicio");
        }
        if (!["Activo", "No Activo"].includes(body.per_status)) {
          throw new Error("El estado debe ser Activo o No Activo");
        }
        if (isEdit) {
          await api(`/api/periodos/${encodeURIComponent(existing.per_codper)}`, {
            method: "PUT",
            body: JSON.stringify({
              per_fecini: body.per_fecini,
              per_fecfin: body.per_fecfin,
              per_status: body.per_status,
            }),
          });
          toast("Periodo actualizado");
        } else {
          await api("/api/periodos", {
            method: "POST",
            body: JSON.stringify(body),
          });
          toast("Periodo creado");
        }
        await loadPeriodos();
      },
      { showMap: false }
    );
  }

  async function loadCentros() {
    state.centros = await api("/api/centros");
    fillFiltroCentros();
    fillFiltroCentrosNic();
    fillFiltroCentrosMoc();
    fillFiltroCentrosTgc();
    renderCentros();
    if (state.section === "monitores-centro") renderMonitoresCentro();
    if (state.section === "ninos-centro") renderNinosCentroBoard();
    if (state.section === "monitores-grupos") renderMonitoresGruposBoard();
    if (state.section === "grupos-centro") renderTiposGruposCentro();
  }

  function renderCentros() {
    const tbody = document.querySelector("#tabla-centros tbody");
    const rows = state.centros.filter((c) =>
      matchSearch([c.exi_codcen, c.exi_nomcen, c.exi_nompob, c.exi_capaci, c.exi_numgru, c.exi_descen, c.cen_usrcre])
    );
    document.getElementById("count-centros").textContent = String(rows.length);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="12" class="empty-state">No hay centros</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map((c) => {
        const baja = Boolean(c.exi_fecbaj);
        const desc = c.exi_descen || "—";
        const descShort = desc.length > 60 ? `${desc.slice(0, 60)}…` : desc;
        return `<tr>
          <td><strong>${esc(c.exi_codcen)}</strong></td>
          <td>${esc(c.exi_nomcen)}</td>
          <td>${c.exi_latgps ?? "—"}</td>
          <td>${c.exi_longgps ?? "—"}</td>
          <td>${esc(c.exi_nompob || "—")}</td>
          <td>${c.exi_capaci ?? "—"}</td>
          <td>${c.exi_numgru ?? 3}</td>
          <td title="${esc(desc)}">${esc(descShort)}</td>
          <td>${esc(c.cen_usrcre || "—")}</td>
          <td>${esc(fmtDate(c.cen_feccre))}</td>
          <td>${baja ? '<span class="badge off">Baja</span>' : '<span class="badge ok">Activo</span>'}</td>
          <td class="row-actions">
            <button type="button" class="linkish" data-act="edit-cen" data-id="${esc(c.exi_codcen)}">Editar</button>
            <button type="button" class="linkish" data-act="map-cen" data-id="${esc(c.exi_codcen)}">Mapa</button>
            ${
              baja
                ? `<button type="button" class="linkish" data-act="react-cen" data-id="${esc(c.exi_codcen)}">Reactivar</button>`
                : `<button type="button" class="linkish danger" data-act="baja-cen" data-id="${esc(c.exi_codcen)}">Baja</button>`
            }
            <button type="button" class="linkish danger" data-act="del-cen" data-id="${esc(c.exi_codcen)}">Borrado</button>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const c = state.centros.find((x) => x.exi_codcen === id);
        try {
          if (btn.dataset.act === "edit-cen") openCentroModal(c);
          if (btn.dataset.act === "map-cen") openMapaCentros(c);
          if (btn.dataset.act === "baja-cen") {
            const ok1 = await askConfirm(`¿Estás seguro de dar de baja este registro?\n\nCentro: ${id}`, "Baja");
            if (!ok1) return;
            const ok2 = await askConfirm("Si pulsas Sí, el centro quedará de baja. Podrás reactivarlo después.\n\n¿Confirmas la baja?", "Confirmar baja");
            if (!ok2) return;
            await api(`/api/centros/${encodeURIComponent(id)}`, { method: "DELETE" });
            toast(`Centro ${id} dado de baja`);
            await loadCentros();
          }
          if (btn.dataset.act === "react-cen") {
            const ok = await askConfirm(`¿Reactivar el centro ${id}?`, "Reactivar");
            if (!ok) return;
            await api(`/api/centros/${encodeURIComponent(id)}/reactivar`, { method: "POST" });
            toast(`Centro ${id} reactivado`);
            await loadCentros();
          }
          if (btn.dataset.act === "del-cen") {
            const ok = await confirmBorrarRegistro(`Centro: ${id}`);
            if (!ok) return;
            await api(`/api/centros/${encodeURIComponent(id)}/permanente`, { method: "DELETE" });
            toast(`Centro ${id} eliminado de la base de datos`);
            await loadCentros();
          }
        } catch (err) {
          toast(err.message, "err");
        }
      });
    });
  }

  function field(name, label, value, opts = {}) {
    const span = opts.span ? ` span-${opts.span}` : "";
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
      return `<div class="field-cell${span}"><label for="f-${name}">${label}</label><input ${attrs} /></div>`;
    }
    const attrs = [
      `name="${name}"`,
      `id="f-${name}"`,
      opts.required ? "required" : "",
      opts.disabled ? "disabled" : "",
      opts.type ? `type="${opts.type}"` : 'type="text"',
      opts.step ? `step="${opts.step}"` : "",
      opts.maxlength ? `maxlength="${opts.maxlength}"` : "",
      opts.placeholder ? `placeholder="${esc(opts.placeholder)}"` : "",
      `value="${esc(value)}"`,
    ]
      .filter(Boolean)
      .join(" ");
    return `<div class="field-cell${span}"><label for="f-${name}">${label}</label><input ${attrs} /></div>`;
  }

  function textareaField(name, label, value, opts = {}) {
    const spanClass = opts.span ? ` span-${opts.span}` : " span-3";
    const attrs = [
      `name="${name}"`,
      `id="f-${name}"`,
      opts.required ? "required" : "",
      opts.maxlength ? `maxlength="${opts.maxlength}"` : "",
      opts.rows ? `rows="${opts.rows}"` : 'rows="4"',
    ]
      .filter(Boolean)
      .join(" ");
    return `<div class="field-cell${spanClass}"><label for="f-${name}">${label}</label><textarea ${attrs}>${esc(value)}</textarea></div>`;
  }

  function selectField(name, label, options, opts = {}) {
    const span = opts.span ? ` span-${opts.span}` : "";
    const optsHtml = options
      .map((o) => {
        const sel = String(o.value) === String(opts.value ?? "") ? " selected" : "";
        return `<option value="${esc(o.value)}"${sel}>${esc(o.label)}</option>`;
      })
      .join("");
    return `<div class="field-cell${span}"><label for="f-${name}">${label}</label>
      <select name="${name}" id="f-${name}" ${opts.required ? "required" : ""} ${opts.disabled ? "disabled" : ""}>${optsHtml}</select></div>`;
  }

  function checkboxField(name, label, checked = false, opts = {}) {
    const span = opts.span ? ` span-${opts.span}` : "";
    return `<div class="field-cell${span} field-check">
      <span class="field-label" id="lbl-${name}">${esc(label)}</span>
      <label class="check-label" for="f-${name}">
        <input type="checkbox" name="${name}" id="f-${name}" value="1" ${checked ? "checked" : ""} aria-labelledby="lbl-${name}" />
        <span>Sí</span>
      </label>
    </div>`;
  }

  function fillFiltroCentros() {
    const sel = document.getElementById("filtro-centro-mon");
    if (!sel) return;
    const prev = state.filtroCentroMon || sel.value;
    const activos = state.centros.filter((c) => !c.exi_fecbaj);
    sel.innerHTML =
      `<option value="">— Selecciona un centro —</option>` +
      activos
        .map((c) => `<option value="${esc(c.exi_codcen)}">${esc(c.exi_codcen)} — ${esc(c.exi_nomcen)}</option>`)
        .join("");
    if (prev && [...sel.options].some((o) => o.value === prev)) {
      sel.value = prev;
      state.filtroCentroMon = prev;
    } else {
      state.filtroCentroMon = "";
    }
  }

  function bindMonitorActions(tbody, afterChange) {
    tbody.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        const m = state.monitores.find((x) => x.mon_codmon === id);
        try {
          if (btn.dataset.act === "edit-mon") {
            openMonitorModal(
              m,
              state.section === "monitores-centro" && state.filtroCentroMon
                ? { fixedCodcen: state.filtroCentroMon }
                : {}
            );
          }
          if (btn.dataset.act === "baja-mon") {
            const ok1 = await askConfirm(`¿Estás seguro de dar de baja este registro?\n\nMonitor: ${id}`, "Baja");
            if (!ok1) return;
            const ok2 = await askConfirm(
              "Si pulsas Sí, el monitor quedará de baja. Podrás reactivarlo después.\n\n¿Confirmas la baja?",
              "Confirmar baja"
            );
            if (!ok2) return;
            await api(`/api/monitores/${id}`, { method: "DELETE" });
            toast(`Monitor ${id} dado de baja`);
            await afterChange();
          }
          if (btn.dataset.act === "react-mon") {
            const ok = await askConfirm(`¿Reactivar el monitor ${id}?`, "Reactivar");
            if (!ok) return;
            await api(`/api/monitores/${id}/reactivar`, { method: "POST" });
            toast(`Monitor ${id} reactivado`);
            await afterChange();
          }
          if (btn.dataset.act === "del-mon") {
            const ok = await confirmBorrarRegistro(`Monitor: ${id}`);
            if (!ok) return;
            await api(`/api/monitores/${id}/permanente`, { method: "DELETE" });
            toast(`Monitor ${id} eliminado de la base de datos`);
            await afterChange();
          }
        } catch (err) {
          toast(err.message, "err");
        }
      });
    });
  }

  function monitorActionButtons(m) {
    const baja = Boolean(m.mon_fecbaj);
    const id = m.mon_codmon;
    return `
      <button type="button" class="linkish" data-act="edit-mon" data-id="${esc(id)}">Editar</button>
      ${
        baja
          ? `<button type="button" class="linkish" data-act="react-mon" data-id="${esc(id)}">Reactivar</button>`
          : `<button type="button" class="linkish danger" data-act="baja-mon" data-id="${esc(id)}">Baja</button>`
      }
      <button type="button" class="linkish danger" data-act="del-mon" data-id="${esc(id)}">Borrado</button>`;
  }

  async function loadMonitores() {
    state.monitores = await api("/api/monitores");
    renderMonitores();
    if (state.section === "monitores-centro") renderMonitoresCentro();
    if (state.section === "monitores-grupos") renderMonitoresGruposBoard();
    if (state.section === "monitores-periodos") renderMonitoresPeriodos();
  }

  async function loadTiposGrupo() {
    state.tiposGrupo = await api("/api/tipos-grupo");
    renderTiposGrupo();
  }

  function fmtNum(value, decimals = 2) {
    if (value == null || value === "") return "—";
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return n.toLocaleString("es-ES", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  async function loadDescuentos() {
    state.descuentos = await api("/api/descuentos");
    renderDescuentos();
  }

  function renderDescuentos() {
    const tbody = document.querySelector("#tabla-descuentos tbody");
    if (!tbody) return;
    const rows = state.descuentos.filter((d) =>
      matchSearch([d.des_coddes, d.des_desdes, d.des_pordes, d.des_usrcre])
    );
    document.getElementById("count-descuentos").textContent = String(rows.length);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No hay descuentos</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map(
        (d) => `<tr>
          <td><strong>${esc(d.des_coddes)}</strong></td>
          <td>${esc(d.des_desdes)}</td>
          <td>${esc(fmtNum(d.des_pordes, 2))} %</td>
          <td>${esc(d.des_usrcre || "—")}</td>
          <td>${esc(fmtDate(d.des_feccre))}</td>
          <td class="row-actions">
            <button type="button" class="linkish" data-act="edit-des" data-id="${esc(d.des_coddes)}">Editar</button>
            <button type="button" class="linkish danger" data-act="del-des" data-id="${esc(d.des_coddes)}">Borrado</button>
          </td>
        </tr>`
      )
      .join("");

    tbody.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const d = state.descuentos.find((x) => x.des_coddes === id);
        try {
          if (btn.dataset.act === "edit-des") openDescuentoModal(d);
          if (btn.dataset.act === "del-des") {
            const ok = await confirmBorrarRegistro(`Descuento: ${id} · ${d?.des_desdes || ""}`);
            if (!ok) return;
            await api(`/api/descuentos/${encodeURIComponent(id)}`, { method: "DELETE" });
            toast(`Descuento ${id} eliminado`);
            await loadDescuentos();
          }
        } catch (err) {
          toast(err.message, "err");
        }
      });
    });
  }

  function openDescuentoModal(existing) {
    const isEdit = Boolean(existing);
    openModal(
      isEdit ? "Editar descuento" : "Nuevo descuento",
      [
        field("des_coddes", "Código", existing?.des_coddes || "", {
          required: true,
          disabled: isEdit,
          maxlength: 20,
          placeholder: "Ej. FAM10",
        }),
        field("des_desdes", "Descripción", existing?.des_desdes || "", {
          required: true,
          maxlength: 100,
          span: 2,
        }),
        field("des_pordes", "% Descuento", existing?.des_pordes ?? "", {
          type: "number",
          step: "0.01",
          required: true,
          placeholder: "Ej. 23.43",
        }),
        ...(isEdit
          ? [
              field("des_usrcre", "Creado por", existing?.des_usrcre || "", { disabled: true }),
              field("des_feccre", "Fecha creación", fmtDate(existing?.des_feccre), { disabled: true }),
            ]
          : []),
      ],
      async (data) => {
        const body = {
          des_coddes: String(data.des_coddes || "").trim().toUpperCase(),
          des_desdes: String(data.des_desdes || "").trim(),
          des_pordes: numOrNull(data.des_pordes),
        };
        if (!body.des_coddes) throw new Error("El código es obligatorio");
        if (!body.des_desdes) throw new Error("La descripción es obligatoria");
        if (body.des_pordes == null || body.des_pordes < 0) {
          throw new Error("El porcentaje debe ser un número >= 0");
        }
        if (isEdit) {
          await api(`/api/descuentos/${encodeURIComponent(existing.des_coddes)}`, {
            method: "PUT",
            body: JSON.stringify({
              des_desdes: body.des_desdes,
              des_pordes: body.des_pordes,
            }),
          });
          toast("Descuento actualizado");
        } else {
          await api("/api/descuentos", {
            method: "POST",
            body: JSON.stringify(body),
          });
          toast("Descuento creado");
        }
        await loadDescuentos();
      }
    );
  }

  async function loadPrecios() {
    state.precios = await api("/api/precios");
    renderPrecios();
  }

  function renderPrecios() {
    const tbody = document.querySelector("#tabla-precios tbody");
    if (!tbody) return;
    const rows = state.precios.filter((p) =>
      matchSearch([p.pre_codpre, p.pre_nompre, p.pre_valpre, p.pre_coddiv, p.pre_usrcre])
    );
    document.getElementById("count-precios").textContent = String(rows.length);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No hay precios</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map(
        (p) => `<tr>
          <td><strong>${esc(p.pre_codpre)}</strong></td>
          <td>${esc(p.pre_nompre)}</td>
          <td>${esc(fmtNum(p.pre_valpre, 2))}</td>
          <td>${esc(p.pre_coddiv || "EUR")}</td>
          <td>${esc(p.pre_usrcre || "—")}</td>
          <td>${esc(fmtDate(p.pre_feccre))}</td>
          <td class="row-actions">
            <button type="button" class="linkish" data-act="edit-pre" data-id="${esc(p.pre_codpre)}">Editar</button>
            <button type="button" class="linkish danger" data-act="del-pre" data-id="${esc(p.pre_codpre)}">Borrado</button>
          </td>
        </tr>`
      )
      .join("");

    tbody.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const p = state.precios.find((x) => x.pre_codpre === id);
        try {
          if (btn.dataset.act === "edit-pre") openPrecioModal(p);
          if (btn.dataset.act === "del-pre") {
            const ok = await confirmBorrarRegistro(`Precio: ${id} · ${p?.pre_nompre || ""}`);
            if (!ok) return;
            await api(`/api/precios/${encodeURIComponent(id)}`, { method: "DELETE" });
            toast(`Precio ${id} eliminado`);
            await loadPrecios();
          }
        } catch (err) {
          toast(err.message, "err");
        }
      });
    });
  }

  function openPrecioModal(existing) {
    const isEdit = Boolean(existing);
    openModal(
      isEdit ? "Editar precio" : "Nuevo precio",
      [
        field("pre_codpre", "Código", existing?.pre_codpre || "", {
          required: true,
          disabled: isEdit,
          maxlength: 20,
          placeholder: "Ej. CAMP_SEM",
        }),
        field("pre_nompre", "Nombre", existing?.pre_nompre || "", {
          required: true,
          maxlength: 100,
          span: 2,
        }),
        field("pre_valpre", "Valor", existing?.pre_valpre ?? "", {
          type: "number",
          step: "0.01",
          required: true,
          placeholder: "Ej. 150.00",
        }),
        field("pre_coddiv", "Divisa", existing?.pre_coddiv || "EUR", {
          required: true,
          maxlength: 3,
          placeholder: "EUR",
        }),
        ...(isEdit
          ? [
              field("pre_usrcre", "Creado por", existing?.pre_usrcre || "", { disabled: true }),
              field("pre_feccre", "Fecha creación", fmtDate(existing?.pre_feccre), { disabled: true }),
            ]
          : []),
      ],
      async (data) => {
        const body = {
          pre_codpre: String(data.pre_codpre || "").trim().toUpperCase(),
          pre_nompre: String(data.pre_nompre || "").trim(),
          pre_valpre: numOrNull(data.pre_valpre),
          pre_coddiv: String(data.pre_coddiv || "EUR").trim().toUpperCase(),
        };
        if (!body.pre_codpre) throw new Error("El código es obligatorio");
        if (!body.pre_nompre) throw new Error("El nombre es obligatorio");
        if (body.pre_valpre == null || body.pre_valpre < 0) {
          throw new Error("El valor debe ser un número >= 0");
        }
        if (!body.pre_coddiv || body.pre_coddiv.length > 3) {
          throw new Error("La divisa debe tener 1-3 caracteres");
        }
        if (isEdit) {
          await api(`/api/precios/${encodeURIComponent(existing.pre_codpre)}`, {
            method: "PUT",
            body: JSON.stringify({
              pre_nompre: body.pre_nompre,
              pre_valpre: body.pre_valpre,
              pre_coddiv: body.pre_coddiv,
            }),
          });
          toast("Precio actualizado");
        } else {
          await api("/api/precios", {
            method: "POST",
            body: JSON.stringify(body),
          });
          toast("Precio creado");
        }
        await loadPrecios();
      }
    );
  }

  async function loadNinos() {
    state.ninos = await api("/api/ninos");
    renderNinos();
    if (state.section === "ninos-periodos") renderNinosPeriodos();
  }

  async function loadNinosPeriodo() {
    state.ninosPeriodo = await api("/api/ninos-periodo");
    if (state.section === "ninos-periodos") renderNinosPeriodos();
  }

  async function ensureNinosPeriodos(force = false) {
    const tasks = [];
    if (force || !state.ninos.length) tasks.push(loadNinos());
    if (force || !state.periodos.length) tasks.push(loadPeriodos());
    if (force || !state.ninosPeriodo.length) tasks.push(loadNinosPeriodo());
    if (tasks.length) await Promise.all(tasks);
    else renderNinosPeriodos();
  }

  function periodosParaMatriz() {
    // Solo periodos con estado Activo (los históricos quedan fuera del checklist)
    const list = state.periodos.filter((p) => isPeriodoActivo(p)).slice();
    list.sort((a, b) => String(a.per_fecini).localeCompare(String(b.per_fecini)));
    return list;
  }

  function asignacionesPorNino() {
    const map = new Map();
    (state.ninosPeriodo || []).forEach((row) => {
      if (!map.has(row.nip_codnin)) map.set(row.nip_codnin, new Set());
      map.get(row.nip_codnin).add(row.nip_codper);
    });
    return map;
  }

  function renderNinosPeriodos() {
    const thead = document.querySelector("#tabla-ninos-periodos thead");
    const tbody = document.querySelector("#tabla-ninos-periodos tbody");
    const countEl = document.getElementById("count-ninos-periodos");
    if (!thead || !tbody) return;

    const periodos = periodosParaMatriz();
    const asign = asignacionesPorNino();
    const ninos = state.ninos
      .filter((n) => !n.nin_fecbaj)
      .filter((n) => matchSearch([n.nin_codnin, n.nin_nomnin, n.nin_tipnin]))
      .sort((a, b) => String(a.nin_nomnin || "").localeCompare(String(b.nin_nomnin || ""), "es"));

    if (countEl) countEl.textContent = String(ninos.length);

    if (!periodos.length) {
      thead.innerHTML = "";
      tbody.innerHTML = `<tr><td class="empty-state">No hay periodos activos. Actívalos en Básicos → Periodos.</td></tr>`;
      return;
    }

    thead.innerHTML = `<tr>
      <th class="nip-col-nino">Niño</th>
      ${periodos
        .map((p) => {
          const vigente = isPeriodoVigente(p);
          return `<th class="nip-col-per${vigente ? " vigente" : ""}" title="${esc(
            `${fmtDateOnly(p.per_fecini)} — ${fmtDateOnly(p.per_fecfin)}`
          )}">
            <span class="nip-per-code">${esc(p.per_codper)}</span>
            <span class="nip-per-dates">${esc(fmtDateOnly(p.per_fecini))} · ${esc(fmtDateOnly(p.per_fecfin))}</span>
          </th>`;
        })
        .join("")}
    </tr>`;

    if (!ninos.length) {
      tbody.innerHTML = `<tr><td colspan="${periodos.length + 1}" class="empty-state">No hay niños activos</td></tr>`;
      return;
    }

    tbody.innerHTML = ninos
      .map((n) => {
        const set = asign.get(n.nin_codnin) || new Set();
        const checks = periodos
          .map((p) => {
            const checked = set.has(p.per_codper);
            return `<td class="nip-check-cell">
              <label class="nip-check" title="${esc(p.per_codper)}">
                <input type="checkbox" data-nin="${n.nin_codnin}" data-per="${esc(p.per_codper)}" ${
              checked ? "checked" : ""
            } />
                <span>Asiste</span>
              </label>
            </td>`;
          })
          .join("");
        return `<tr>
          <td class="nip-col-nino">
            <strong>${esc(n.nin_nomnin)}</strong>
            <span class="nip-nino-meta">#${esc(n.nin_codnin)}${
              n.nin_tipnin ? ` · ${esc(n.nin_tipnin)}` : ""
            }</span>
          </td>
          ${checks}
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll('input[type="checkbox"][data-nin]').forEach((chk) => {
      chk.addEventListener("change", async () => {
        const codnin = Number(chk.dataset.nin);
        const codper = chk.dataset.per;
        chk.disabled = true;
        try {
          if (chk.checked) {
            await api("/api/ninos-periodo", {
              method: "POST",
              body: JSON.stringify({ nip_codnin: codnin, nip_codper: codper }),
            });
          } else {
            await api(
              `/api/ninos-periodo/nino/${codnin}/periodo/${encodeURIComponent(codper)}`,
              { method: "DELETE" }
            );
          }
          await loadNinosPeriodo();
          toast(chk.checked ? `Periodo ${codper} marcado` : `Periodo ${codper} quitado`);
        } catch (err) {
          chk.checked = !chk.checked;
          toast(err.message, "err");
        } finally {
          chk.disabled = false;
        }
      });
    });
  }

  async function loadMonitoresPeriodo() {
    state.monitoresPeriodo = await api("/api/monitores-periodo");
    if (state.section === "monitores-periodos") renderMonitoresPeriodos();
  }

  async function ensureMonitoresPeriodos(force = false) {
    const tasks = [];
    if (force || !state.monitores.length) tasks.push(loadMonitores());
    if (force || !state.periodos.length) tasks.push(loadPeriodos());
    if (force || !state.monitoresPeriodo.length) tasks.push(loadMonitoresPeriodo());
    if (tasks.length) await Promise.all(tasks);
    else renderMonitoresPeriodos();
  }

  function asignacionesPorMonitor() {
    const map = new Map();
    (state.monitoresPeriodo || []).forEach((row) => {
      if (!map.has(row.mpe_codmon)) map.set(row.mpe_codmon, new Set());
      map.get(row.mpe_codmon).add(row.mpe_codper);
    });
    return map;
  }

  function renderMonitoresPeriodos() {
    const thead = document.querySelector("#tabla-monitores-periodos thead");
    const tbody = document.querySelector("#tabla-monitores-periodos tbody");
    const countEl = document.getElementById("count-monitores-periodos");
    if (!thead || !tbody) return;

    const periodos = periodosParaMatriz();
    const asign = asignacionesPorMonitor();
    const monitores = state.monitores
      .filter((m) => !m.mon_fecbaj)
      .filter((m) => matchSearch([m.mon_codmon, m.mon_nommon, m.mon_tipmon, m.mon_codusr]))
      .sort((a, b) => String(a.mon_nommon || "").localeCompare(String(b.mon_nommon || ""), "es"));

    if (countEl) countEl.textContent = String(monitores.length);

    if (!periodos.length) {
      thead.innerHTML = "";
      tbody.innerHTML = `<tr><td class="empty-state">No hay periodos activos. Actívalos en Básicos → Periodos.</td></tr>`;
      return;
    }

    thead.innerHTML = `<tr>
      <th class="nip-col-nino">Monitor</th>
      ${periodos
        .map((p) => {
          const vigente = isPeriodoVigente(p);
          return `<th class="nip-col-per${vigente ? " vigente" : ""}" title="${esc(
            `${fmtDateOnly(p.per_fecini)} — ${fmtDateOnly(p.per_fecfin)}`
          )}">
            <span class="nip-per-code">${esc(p.per_codper)}</span>
            <span class="nip-per-dates">${esc(fmtDateOnly(p.per_fecini))} · ${esc(fmtDateOnly(p.per_fecfin))}</span>
          </th>`;
        })
        .join("")}
    </tr>`;

    if (!monitores.length) {
      tbody.innerHTML = `<tr><td colspan="${periodos.length + 1}" class="empty-state">No hay monitores activos</td></tr>`;
      return;
    }

    tbody.innerHTML = monitores
      .map((m) => {
        const set = asign.get(m.mon_codmon) || new Set();
        const checks = periodos
          .map((p) => {
            const checked = set.has(p.per_codper);
            return `<td class="nip-check-cell">
              <label class="nip-check" title="${esc(p.per_codper)}">
                <input type="checkbox" data-mon="${m.mon_codmon}" data-per="${esc(p.per_codper)}" ${
              checked ? "checked" : ""
            } />
                <span>Va</span>
              </label>
            </td>`;
          })
          .join("");
        return `<tr>
          <td class="nip-col-nino">
            <strong>${esc(m.mon_nommon)}</strong>
            <span class="nip-nino-meta">#${esc(m.mon_codmon)}${
              m.mon_tipmon ? ` · ${esc(m.mon_tipmon)}` : ""
            }</span>
          </td>
          ${checks}
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll('input[type="checkbox"][data-mon]').forEach((chk) => {
      chk.addEventListener("change", async () => {
        const codmon = Number(chk.dataset.mon);
        const codper = chk.dataset.per;
        chk.disabled = true;
        try {
          if (chk.checked) {
            await api("/api/monitores-periodo", {
              method: "POST",
              body: JSON.stringify({ mpe_codmon: codmon, mpe_codper: codper }),
            });
          } else {
            await api(
              `/api/monitores-periodo/monitor/${codmon}/periodo/${encodeURIComponent(codper)}`,
              { method: "DELETE" }
            );
          }
          await loadMonitoresPeriodo();
          toast(chk.checked ? `Periodo ${codper} marcado` : `Periodo ${codper} quitado`);
        } catch (err) {
          chk.checked = !chk.checked;
          toast(err.message, "err");
        } finally {
          chk.disabled = false;
        }
      });
    });
  }

  function buildPeriodosMatrixExport(kind) {
    const periodos = periodosParaMatriz();
    if (!periodos.length) {
      toast("No hay periodos activos para exportar", "err");
      return null;
    }

    const perHeaders = periodos.map(
      (p) => `${p.per_codper} (${fmtDateOnly(p.per_fecini)} - ${fmtDateOnly(p.per_fecfin)})`
    );

    if (kind === "ninos") {
      const asign = asignacionesPorNino();
      const ninos = state.ninos
        .filter((n) => !n.nin_fecbaj)
        .filter((n) => matchSearch([n.nin_codnin, n.nin_nomnin, n.nin_tipnin]))
        .sort((a, b) => String(a.nin_nomnin || "").localeCompare(String(b.nin_nomnin || ""), "es"));
      if (!ninos.length) {
        toast("No hay niños para exportar", "err");
        return null;
      }
      return {
        title: "Periodos de niños",
        subtitle: "Semanas / periodos en los que cada niño asiste al campus",
        filename: "exi_ninos_periodos",
        headers: ["Niño", "Tipo", ...perHeaders],
        rows: ninos.map((n) => {
          const set = asign.get(n.nin_codnin) || new Set();
          return [
            `${n.nin_nomnin || ""} (#${n.nin_codnin})`,
            n.nin_tipnin || "",
            ...periodos.map((p) => (set.has(p.per_codper) ? "Sí" : "")),
          ];
        }),
      };
    }

    const asign = asignacionesPorMonitor();
    const monitores = state.monitores
      .filter((m) => !m.mon_fecbaj)
      .filter((m) => matchSearch([m.mon_codmon, m.mon_nommon, m.mon_tipmon, m.mon_codusr]))
      .sort((a, b) => String(a.mon_nommon || "").localeCompare(String(b.mon_nommon || ""), "es"));
    if (!monitores.length) {
      toast("No hay monitores para exportar", "err");
      return null;
    }
    return {
      title: "Periodos de monitores",
      subtitle: "Semanas / periodos en los que cada monitor va al campus",
      filename: "exi_monitores_periodos",
      headers: ["Monitor", "Tipo", ...perHeaders],
      rows: monitores.map((m) => {
        const set = asign.get(m.mon_codmon) || new Set();
        return [
          `${m.mon_nommon || ""} (#${m.mon_codmon})`,
          m.mon_tipmon || "",
          ...periodos.map((p) => (set.has(p.per_codper) ? "Sí" : "")),
        ];
      }),
    };
  }

  function exportNinosPeriodos(format) {
    const data = buildPeriodosMatrixExport("ninos");
    if (!data) return;
    if (format === "pdf") {
      downloadMatrixPdf(data);
      toast("Informe PDF descargado");
    } else {
      downloadMatrixCsv(data);
      toast("CSV descargado");
    }
  }

  function exportMonitoresPeriodos(format) {
    const data = buildPeriodosMatrixExport("monitores");
    if (!data) return;
    if (format === "pdf") {
      downloadMatrixPdf(data);
      toast("Informe PDF descargado");
    } else {
      downloadMatrixCsv(data);
      toast("CSV descargado");
    }
  }

  function renderTiposGrupo() {
    const tbody = document.querySelector("#tabla-tipos-grupo tbody");
    if (!tbody) return;
    const rows = state.tiposGrupo.filter((t) => matchSearch([t.tip_codgru, t.tip_descri, t.tip_usrcre]));
    document.getElementById("count-tipos-grupo").textContent = String(rows.length);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No hay tipos de grupo</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map((t) => {
        const baja = Boolean(t.tip_fecbaj);
        return `<tr>
          <td><strong>${esc(t.tip_codgru)}</strong></td>
          <td>${esc(t.tip_descri)}</td>
          <td>${esc(t.tip_usrcre || "—")}</td>
          <td>${esc(fmtDate(t.tip_feccre))}</td>
          <td>${baja ? '<span class="badge off">Baja</span>' : '<span class="badge ok">Activo</span>'}</td>
          <td class="row-actions">
            <button type="button" class="linkish" data-act="edit-tip" data-id="${t.tip_codgru}">Editar</button>
            ${
              baja
                ? `<button type="button" class="linkish" data-act="react-tip" data-id="${t.tip_codgru}">Reactivar</button>`
                : `<button type="button" class="linkish danger" data-act="baja-tip" data-id="${t.tip_codgru}">Baja</button>`
            }
            <button type="button" class="linkish danger" data-act="del-tip" data-id="${t.tip_codgru}">Borrado</button>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        const t = state.tiposGrupo.find((x) => x.tip_codgru === id);
        try {
          if (btn.dataset.act === "edit-tip") openTipoGrupoModal(t);
          if (btn.dataset.act === "baja-tip") {
            const ok1 = await askConfirm(
              `¿Estás seguro de dar de baja este registro?\n\nTipo: ${t?.tip_descri || id}`,
              "Baja"
            );
            if (!ok1) return;
            const ok2 = await askConfirm(
              "Si pulsas Sí, el tipo quedará de baja. Podrás reactivarlo después.\n\n¿Confirmas la baja?",
              "Confirmar baja"
            );
            if (!ok2) return;
            await api(`/api/tipos-grupo/${id}`, { method: "DELETE" });
            toast("Tipo de grupo dado de baja");
            await loadTiposGrupo();
          }
          if (btn.dataset.act === "react-tip") {
            const ok = await askConfirm(`¿Reactivar el tipo ${t?.tip_descri || id}?`, "Reactivar");
            if (!ok) return;
            await api(`/api/tipos-grupo/${id}/reactivar`, { method: "POST" });
            toast("Tipo de grupo reactivado");
            await loadTiposGrupo();
          }
          if (btn.dataset.act === "del-tip") {
            const ok = await confirmBorrarRegistro(`Tipo: ${t?.tip_descri || id}`);
            if (!ok) return;
            await api(`/api/tipos-grupo/${id}/permanente`, { method: "DELETE" });
            toast("Tipo de grupo eliminado");
            await loadTiposGrupo();
          }
        } catch (err) {
          toast(err.message, "err");
        }
      });
    });
  }

  function openTipoGrupoModal(existing) {
    const isEdit = Boolean(existing);
    openModal(
      isEdit ? "Editar tipo de grupo" : "Nuevo tipo de grupo",
      [
        ...(isEdit ? [field("tip_codgru", "Código", existing.tip_codgru, { disabled: true })] : []),
        field("tip_descri", "Descripción", existing?.tip_descri || "", {
          required: true,
          maxlength: 100,
          span: isEdit ? 2 : 3,
        }),
        ...(isEdit
          ? [
              field("tip_usrcre", "Creado por", existing?.tip_usrcre || "", { disabled: true }),
              field("tip_feccre", "Fecha creación", existing?.tip_feccre ? fmtDate(existing.tip_feccre) : "", {
                disabled: true,
              }),
            ]
          : []),
      ],
      async (data) => {
        const body = { tip_descri: (data.tip_descri || "").trim() };
        if (!body.tip_descri) throw new Error("La descripción es obligatoria");
        if (isEdit) {
          await api(`/api/tipos-grupo/${existing.tip_codgru}`, {
            method: "PUT",
            body: JSON.stringify(body),
          });
          toast("Tipo de grupo actualizado");
        } else {
          await api("/api/tipos-grupo", {
            method: "POST",
            body: JSON.stringify(body),
          });
          toast("Tipo de grupo creado");
        }
        await loadTiposGrupo();
      },
      { showMap: false }
    );
  }

  function fillFiltroCentrosTgc() {
    const sel = document.getElementById("filtro-centro-tgc");
    if (!sel) return;
    const prev = state.filtroCentroTgc || sel.value;
    const activos = state.centros.filter((c) => !c.exi_fecbaj);
    sel.innerHTML =
      `<option value="">— Selecciona un centro —</option>` +
      activos
        .map((c) => `<option value="${esc(c.exi_codcen)}">${esc(c.exi_codcen)} — ${esc(c.exi_nomcen)}</option>`)
        .join("");
    if (prev && [...sel.options].some((o) => o.value === prev)) {
      sel.value = prev;
      state.filtroCentroTgc = prev;
    } else if (!state.verTodosTgc) {
      state.filtroCentroTgc = "";
    }
  }

  async function loadTiposGruposCentro() {
    if (!state.tiposGrupo.length) {
      state.tiposGrupo = await api("/api/tipos-grupo");
    }
    const q =
      state.verTodosTgc || !state.filtroCentroTgc
        ? ""
        : `?codcen=${encodeURIComponent(state.filtroCentroTgc)}`;
    // si no hay filtro ni "ver todos", lista vacía en UI
    if (!state.verTodosTgc && !state.filtroCentroTgc) {
      state.tiposGruposCentro = [];
      renderTiposGruposCentro();
      return;
    }
    state.tiposGruposCentro = await api(`/api/tipos-grupos-centro${q}`);
    renderTiposGruposCentro();
  }

  function renderTiposGruposCentro() {
    const tbody = document.querySelector("#tabla-grupos-centro tbody");
    if (!tbody) return;
    const rows = state.tiposGruposCentro.filter((r) =>
      matchSearch([
        r.tgc_codtgc,
        r.tgc_codcen,
        r.exi_nomcen,
        r.tip_descri,
        r.tgc_ordgru,
        r.tgc_tipgru,
        r.ninos_total,
        r.ninos_apoyo,
        r.monitores_txt,
        ...(r.monitores || []),
      ])
    );
    const countEl = document.getElementById("count-grupos-centro");
    if (countEl) countEl.textContent = String(rows.length);
    if (!state.verTodosTgc && !state.filtroCentroTgc) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Selecciona un centro o pulsa Ver todos</td></tr>`;
      return;
    }
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No hay grupos asociados</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map((r) => {
        const centroLabel = r.exi_nomcen
          ? `${esc(r.tgc_codcen)} — ${esc(r.exi_nomcen)}`
          : esc(r.tgc_codcen);
        const apoyo = Number(r.ninos_apoyo) || 0;
        const mons = Array.isArray(r.monitores) ? r.monitores : [];
        const monsHtml = mons.length
          ? mons.map((m) => `<span class="badge nic-tipo">${esc(m)}</span>`).join(" ")
          : "—";
        return `<tr>
          <td><strong>${esc(r.tgc_codtgc)}</strong></td>
          <td>${centroLabel}</td>
          <td>${esc(r.tip_descri || r.tgc_tipgru)}</td>
          <td>${esc(r.tgc_ordgru)}</td>
          <td>${esc(r.ninos_total ?? 0)}</td>
          <td>${
            apoyo > 0
              ? `<span class="badge nic-apoyo" title="Niños que necesitan apoyo">${apoyo}</span>`
              : "0"
          }</td>
          <td class="tgc-mons">${monsHtml}</td>
          <td class="row-actions">
            <button type="button" class="linkish" data-act="edit-tgc" data-id="${r.tgc_codtgc}">Editar</button>
            <button type="button" class="linkish danger" data-act="del-tgc" data-id="${r.tgc_codtgc}">Quitar</button>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        const r = state.tiposGruposCentro.find((x) => x.tgc_codtgc === id);
        try {
          if (btn.dataset.act === "edit-tgc") openTipoGrupoCentroModal(r);
          if (btn.dataset.act === "del-tgc") {
            const ok = await askConfirm(
              `¿Quitar el grupo «${r?.tip_descri || id}» del centro ${r?.tgc_codcen || ""}?`,
              "Quitar asociación"
            );
            if (!ok) return;
            await api(`/api/tipos-grupos-centro/${id}`, { method: "DELETE" });
            toast("Grupo desasociado del centro");
            await loadTiposGruposCentro();
          }
        } catch (err) {
          toast(err.message, "err");
        }
      });
    });
  }

  function openTipoGrupoCentroModal(existing, opts = {}) {
    const isEdit = Boolean(existing);
    const fixedCodcen = opts.fixedCodcen || existing?.tgc_codcen || state.filtroCentroTgc || "";
    const cenOpts = [
      { value: "", label: "— Seleccionar —" },
      ...state.centros
        .filter((c) => !c.exi_fecbaj || c.exi_codcen === existing?.tgc_codcen)
        .map((c) => ({ value: c.exi_codcen, label: `${c.exi_codcen} — ${c.exi_nomcen}` })),
    ];
    const tipOpts = [
      { value: "", label: "— Seleccionar —" },
      ...state.tiposGrupo
        .filter((t) => !t.tip_fecbaj || t.tip_codgru === existing?.tgc_tipgru)
        .map((t) => ({ value: String(t.tip_codgru), label: t.tip_descri })),
    ];
    if (isEdit && existing.tgc_tipgru && !tipOpts.some((o) => o.value === String(existing.tgc_tipgru))) {
      tipOpts.push({
        value: String(existing.tgc_tipgru),
        label: existing.tip_descri || String(existing.tgc_tipgru),
      });
    }
    const nextOrd =
      existing?.tgc_ordgru ??
      (state.tiposGruposCentro
        .filter((x) => x.tgc_codcen === fixedCodcen)
        .reduce((m, x) => Math.max(m, Number(x.tgc_ordgru) || 0), 0) + 1 || 1);

    openModal(
      isEdit ? "Editar grupo del centro" : "Asociar grupo al centro",
      [
        ...(isEdit ? [field("tgc_codtgc", "Código", existing.tgc_codtgc, { disabled: true })] : []),
        selectField("tgc_codcen", "Centro", cenOpts, {
          value: fixedCodcen,
          required: true,
          disabled: Boolean(opts.fixedCodcen) && !isEdit,
        }),
        selectField("tgc_tipgru", "Tipo de grupo", tipOpts, {
          value: existing ? String(existing.tgc_tipgru) : "",
          required: true,
        }),
        field("tgc_ordgru", "Orden", nextOrd, { type: "number", step: "1", required: true }),
      ],
      async (data) => {
        const body = {
          tgc_codcen: opts.fixedCodcen || data.tgc_codcen || fixedCodcen,
          tgc_tipgru: Number(data.tgc_tipgru),
          tgc_ordgru: Number(data.tgc_ordgru) || 1,
        };
        if (!body.tgc_codcen) throw new Error("Selecciona un centro");
        if (!body.tgc_tipgru) throw new Error("Selecciona un tipo de grupo");
        if (isEdit) {
          await api(`/api/tipos-grupos-centro/${existing.tgc_codtgc}`, {
            method: "PUT",
            body: JSON.stringify(body),
          });
          toast("Asociación actualizada");
        } else {
          await api("/api/tipos-grupos-centro", {
            method: "POST",
            body: JSON.stringify(body),
          });
          toast("Grupo asociado al centro");
        }
        await loadTiposGruposCentro();
      },
      { showMap: false }
    );
  }

  function ninoActionButtons(n) {
    const baja = Boolean(n.nin_fecbaj);
    return `
      <button type="button" class="linkish" data-act="edit-nin" data-id="${n.nin_codnin}">Editar</button>
      ${
        baja
          ? `<button type="button" class="linkish" data-act="react-nin" data-id="${n.nin_codnin}" title="Quitar fecha de baja">Reactivar</button>`
          : `<button type="button" class="linkish danger" data-act="baja-nin" data-id="${n.nin_codnin}" title="Baja lógica">Baja</button>`
      }
      <button type="button" class="linkish danger" data-act="del-nin" data-id="${n.nin_codnin}" title="Eliminar de la base de datos">Borrado</button>
    `;
  }

  function bindNinoActions(tbody) {
    tbody.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        const n = state.ninos.find((x) => x.nin_codnin === id);
        try {
          if (btn.dataset.act === "edit-nin") openNinoModal(n);
          if (btn.dataset.act === "baja-nin") {
            const ok1 = await askConfirm(
              `¿Estás seguro de dar de baja este registro?\n\nNiño: ${n?.nin_nomnin || id}`,
              "Baja"
            );
            if (!ok1) return;
            const ok2 = await askConfirm(
              "Si pulsas Sí, el niño quedará de baja. Podrás reactivarlo después.\n\n¿Confirmas la baja?",
              "Confirmar baja"
            );
            if (!ok2) return;
            await api(`/api/ninos/${id}`, { method: "DELETE" });
            toast("Niño dado de baja");
            await loadNinos();
          }
          if (btn.dataset.act === "react-nin") {
            const ok = await askConfirm(`¿Reactivar al niño ${n?.nin_nomnin || id}?`, "Reactivar");
            if (!ok) return;
            await api(`/api/ninos/${id}/reactivar`, { method: "POST" });
            toast("Niño reactivado");
            await loadNinos();
          }
          if (btn.dataset.act === "del-nin") {
            const ok = await confirmBorrarRegistro(`Niño: ${n?.nin_nomnin || id}`);
            if (!ok) return;
            await api(`/api/ninos/${id}/permanente`, { method: "DELETE" });
            toast("Niño eliminado de la base de datos");
            await loadNinos();
          }
        } catch (err) {
          toast(err.message, "err");
        }
      });
    });
  }

  const TIPOS_NINO_FALLBACK = [
    "PEQUEÑOS",
    "MEDIANOS",
    "MAYORES",
    "PEQUEÑOS 1",
    "PEQUEÑOS 2",
  ];

  const GRUPOS_POR_NUM = {
    3: ["PEQUEÑOS", "MEDIANOS", "MAYORES"],
    4: ["PEQUEÑOS 1", "PEQUEÑOS 2", "MEDIANOS", "MAYORES"],
  };

  function tipOptsNino(extraValue) {
    const activos = (state.tiposGrupo || []).filter((t) => !t.tip_fecbaj);
    const values = activos.length
      ? activos.map((t) => t.tip_descri)
      : TIPOS_NINO_FALLBACK;
    const opts = [{ value: "", label: "— Seleccionar —" }, ...values.map((v) => ({ value: v, label: v }))];
    if (extraValue && !opts.some((o) => o.value === extraValue)) {
      opts.push({ value: extraValue, label: extraValue });
    }
    return opts;
  }

  function tipNinoBadge(tip) {
    if (!tip) return "—";
    return `<span class="badge nic-tipo">${esc(tip)}</span>`;
  }

  function numGruCentro(codcen) {
    const c = state.centros.find((x) => x.exi_codcen === codcen);
    return c?.exi_numgru === 4 ? 4 : 3;
  }

  function gruposFijosCentro(codcen) {
    if (codcen && state.filtroCentroNic === codcen && state.gruposCentro.length) {
      return [...state.gruposCentro];
    }
    return [...(GRUPOS_POR_NUM[numGruCentro(codcen)] || GRUPOS_POR_NUM[3])];
  }

  async function aplicarTipoNino(codnin, tipnin) {
    if (!tipnin) return null;
    const updated = await api(`/api/ninos/${codnin}`, {
      method: "PUT",
      body: JSON.stringify({ nin_tipnin: tipnin }),
    });
    const idx = state.ninos.findIndex((x) => x.nin_codnin === codnin);
    if (idx >= 0) state.ninos[idx] = { ...state.ninos[idx], ...updated };
    state.ninosCent.forEach((a) => {
      if (a.nic_codnin === codnin) a.nin_tipnin = tipnin;
    });
    return updated;
  }

  function renderNinos() {
    const tbody = document.querySelector("#tabla-ninos tbody");
    if (!tbody) return;
    const rows = state.ninos.filter((n) =>
      matchSearch([
        n.nin_codnin,
        n.nin_nomnin,
        n.nin_tipnin,
        n.nin_apoyo ? "sí" : "no",
        n.nin_fecnac,
        n.nin_comali,
        n.nin_desnin,
        n.nin_usrcre,
      ])
    );
    document.getElementById("count-ninos").textContent = String(rows.length);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="11" class="empty-state">No hay niños</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map((n) => {
        const baja = Boolean(n.nin_fecbaj);
        const desc = n.nin_desnin || "—";
        const descShort = desc.length > 60 ? `${desc.slice(0, 60)}…` : desc;
        const comali = (n.nin_comali || "").trim();
        const comaliShort = comali.length > 40 ? `${comali.slice(0, 40)}…` : comali || "—";
        return `<tr>
          <td><strong>${esc(n.nin_codnin)}</strong></td>
          <td>${esc(n.nin_nomnin)}</td>
          <td>${tipNinoBadge(n.nin_tipnin)}</td>
          <td>${n.nin_apoyo ? '<span class="badge ok">Sí</span>' : '<span class="badge off">No</span>'}</td>
          <td>${esc(fmtDateOnly(n.nin_fecnac))}</td>
          <td class="nin-comali-cell" title="${esc(comali || "")}">${
            comali ? `<span class="badge nin-comali">${esc(comaliShort)}</span>` : "—"
          }</td>
          <td title="${esc(desc)}">${esc(descShort)}</td>
          <td>${esc(n.nin_usrcre || "—")}</td>
          <td>${esc(fmtDate(n.nin_feccre))}</td>
          <td>${baja ? '<span class="badge off">Baja</span>' : '<span class="badge ok">Activo</span>'}</td>
          <td class="row-actions">${ninoActionButtons(n)}</td>
        </tr>`;
      })
      .join("");
    bindNinoActions(tbody);
  }

  function openNinoModal(existing) {
    const isEdit = Boolean(existing);
    const tipOpts = tipOptsNino(isEdit ? existing?.nin_tipnin : null);
    openModal(
      isEdit ? "Editar niño" : "Nuevo niño",
      [
        ...(isEdit ? [field("nin_codnin", "Código", existing.nin_codnin, { disabled: true })] : []),
        field("nin_nomnin", "Nombre", existing?.nin_nomnin || "", { required: true, maxlength: 100 }),
        selectField("nin_tipnin", "Tipo", tipOpts, { value: existing?.nin_tipnin || "" }),
        field("nin_fecnac", "Fecha de nacimiento", toInputDate(existing?.nin_fecnac), { type: "date" }),
        checkboxField("nin_apoyo", "Necesita apoyo", Boolean(existing?.nin_apoyo)),
        field("nin_comali", "Comentario alimenticio", existing?.nin_comali || "", {
          maxlength: 100,
          placeholder: "Ej: CELIACO, No come CERDO…",
        }),
        textareaField("nin_desnin", "Descripción", existing?.nin_desnin || "", {
          maxlength: 900,
          rows: 4,
          span: 3,
        }),
        ...(isEdit
          ? [
              field("nin_usrcre", "Creado por", existing?.nin_usrcre || "", { disabled: true }),
              field("nin_feccre", "Fecha creación", existing?.nin_feccre ? fmtDate(existing.nin_feccre) : "", {
                disabled: true,
              }),
            ]
          : []),
      ],
      async (data) => {
        const body = {
          nin_nomnin: data.nin_nomnin,
          nin_tipnin: data.nin_tipnin || null,
          nin_fecnac: data.nin_fecnac || null,
          nin_apoyo: Boolean(data.nin_apoyo),
          nin_comali: (data.nin_comali || "").trim() || null,
          nin_desnin: data.nin_desnin || null,
        };
        if (isEdit) {
          await api(`/api/ninos/${existing.nin_codnin}`, {
            method: "PUT",
            body: JSON.stringify(body),
          });
          toast("Niño actualizado");
        } else {
          await api("/api/ninos", {
            method: "POST",
            body: JSON.stringify(body),
          });
          toast("Niño creado");
        }
        await loadNinos();
      },
      { showMap: false }
    );
  }

  function fillFiltroCentrosNic() {
    const sel = document.getElementById("filtro-centro-nic");
    if (!sel) return;
    const prev = state.filtroCentroNic || sel.value;
    const activos = state.centros.filter((c) => !c.exi_fecbaj);
    sel.innerHTML =
      `<option value="">— Selecciona un centro —</option>` +
      activos
        .map((c) => `<option value="${esc(c.exi_codcen)}">${esc(c.exi_codcen)} — ${esc(c.exi_nomcen)}</option>`)
        .join("");
    if (prev && [...sel.options].some((o) => o.value === prev)) {
      sel.value = prev;
      state.filtroCentroNic = prev;
    } else {
      state.filtroCentroNic = "";
    }
  }

  function periodoOpcionLabel(p) {
    return `${p.per_codper} (${fmtDateOnly(p.per_fecini)} - ${fmtDateOnly(p.per_fecfin)})`;
  }

  function periodoDefaultCod() {
    const activos = periodosParaMatriz();
    const vig = activos.find((p) => isPeriodoVigente(p));
    return (vig || activos[0])?.per_codper || "";
  }

  function fillFiltroPeriodos(selId, stateKey) {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const prev = state[stateKey] || sel.value;
    const activos = periodosParaMatriz();
    sel.innerHTML =
      `<option value="">— Selecciona un periodo —</option>` +
      activos
        .map((p) => `<option value="${esc(p.per_codper)}">${esc(periodoOpcionLabel(p))}</option>`)
        .join("");
    const fallback = prev || periodoDefaultCod();
    if (fallback && [...sel.options].some((o) => o.value === fallback)) {
      sel.value = fallback;
      state[stateKey] = fallback;
    } else {
      state[stateKey] = "";
      sel.value = "";
    }
  }

  function idsNinosEnPeriodo(codper) {
    const set = new Set();
    if (!codper) return set;
    (state.ninosPeriodo || []).forEach((r) => {
      if (r.nip_codper === codper) set.add(r.nip_codnin);
    });
    return set;
  }

  function idsMonitoresEnPeriodo(codper) {
    const set = new Set();
    if (!codper) return set;
    (state.monitoresPeriodo || []).forEach((r) => {
      if (r.mpe_codper === codper) set.add(r.mpe_codmon);
    });
    return set;
  }

  async function ensureNinosBoard(force = false) {
    const jobs = [];
    if (!state.centros.length || force) jobs.push(loadCentros());
    if (!state.ninos.length || force) jobs.push(loadNinos());
    if (!state.periodos.length || force) jobs.push(loadPeriodos());
    if (!state.ninosPeriodo.length || force) jobs.push(loadNinosPeriodo());
    if (jobs.length) await Promise.all(jobs);
    fillFiltroCentrosNic();
    fillFiltroPeriodos("filtro-periodo-nic", "filtroPeriodoNic");
    if (state.filtroCentroNic) await loadNinosCent(state.filtroCentroNic);
    else {
      state.ninosCent = [];
      state.gruposCentro = [];
    }
    renderNinosCentroBoard();
  }

  async function loadNinosCent(codcen) {
    const [asigs, grupos] = await Promise.all([
      api(`/api/ninos-cent?codcen=${encodeURIComponent(codcen)}`),
      api(`/api/tipos-grupos-centro?codcen=${encodeURIComponent(codcen)}`),
    ]);
    state.ninosCent = asigs;
    state.gruposCentro = (grupos || [])
      .slice()
      .sort((a, b) => (a.tgc_ordgru || 0) - (b.tgc_ordgru || 0))
      .map((g) => g.tip_descri)
      .filter(Boolean);
    if (!state.gruposCentro.length) {
      state.gruposCentro = [...(GRUPOS_POR_NUM[numGruCentro(codcen)] || GRUPOS_POR_NUM[3])];
    }
  }

  function ninosDisponibles() {
    const assigned = new Set(
      state.ninosCent
        .filter((a) => a.nic_codcen === state.filtroCentroNic)
        .map((a) => a.nic_codnin)
    );
    const enPeriodo = idsNinosEnPeriodo(state.filtroPeriodoNic);
    const q = (state.buscaNicDisp || "").trim().toLowerCase();
    return state.ninos.filter((n) => {
      if (n.nin_fecbaj) return false;
      if (state.filtroPeriodoNic && !enPeriodo.has(n.nin_codnin)) return false;
      if (assigned.has(n.nin_codnin)) return false;
      if (state.soloSinGrupo && (n.nin_tipnin || "").trim()) return false;
      if (!q) return true;
      return [n.nin_codnin, n.nin_nomnin, n.nin_tipnin, n.nin_desnin].some((f) =>
        String(f ?? "")
          .toLowerCase()
          .includes(q)
      );
    });
  }

  function edadAnios(fecnac) {
    if (!fecnac) return null;
    const s = String(fecnac).slice(0, 10);
    const [y, m, d] = s.split("-").map(Number);
    if (!y || !m || !d) return null;
    const nac = new Date(y, m - 1, d);
    if (Number.isNaN(nac.getTime())) return null;
    const hoy = new Date();
    let edad = hoy.getFullYear() - nac.getFullYear();
    const md = hoy.getMonth() - nac.getMonth();
    if (md < 0 || (md === 0 && hoy.getDate() < nac.getDate())) edad -= 1;
    return edad >= 0 ? edad : null;
  }

  function edadLabel(fecnac) {
    const e = edadAnios(fecnac);
    if (e == null) return "—";
    return e === 1 ? "1 año" : `${e} años`;
  }

  function ninoNecesitaApoyo(n, asoc) {
    if (asoc && asoc.nin_apoyo != null) return Boolean(asoc.nin_apoyo);
    if (n && n.nin_apoyo != null) return Boolean(n.nin_apoyo);
    const cod = asoc?.nic_codnin || n?.nin_codnin;
    const full = state.ninos.find((x) => x.nin_codnin === cod);
    return Boolean(full?.nin_apoyo);
  }

  function countBadgeHtml(total, apoyo) {
    const apoyoPart =
      apoyo > 0
        ? `<span class="card-count-apoyo" title="${apoyo} necesitan apoyo (monitor extra)">${apoyo} apoyo</span>`
        : "";
    return `<span class="card-count-wrap"><span class="card-count">${total}</span>${apoyoPart}</span>`;
  }

  function cardNinoHtml(n, asoc) {
    const id = asoc ? asoc.nic_codnic : n.nin_codnin;
    const kind = asoc ? "asig" : "disp";
    const nombre = asoc?.nin_nomnin || n.nin_nomnin;
    const tip = asoc?.nic_tipgru || asoc?.nin_tipnin || n.nin_tipnin || "";
    const apoyo = ninoNecesitaApoyo(n, asoc);
    const fecnac = asoc?.nin_fecnac || n.nin_fecnac;
    const fecnacTxt = fmtDateOnly(fecnac);
    const edad = edadLabel(fecnac);
    return `<article class="nic-card${apoyo ? " nic-card-apoyo" : ""}" draggable="true" data-kind="${kind}" data-id="${id}" data-codnin="${n.nin_codnin || asoc.nic_codnin}">
      <div class="nic-card-top">
        <strong>${esc(nombre)}</strong>
        <span class="nic-edad" title="Edad">${esc(edad)}</span>
      </div>
      <div class="nic-card-tipo-row">
        ${tip ? `<span class="badge nic-tipo">${esc(tip)}</span>` : `<span class="badge nic-tipo off">Sin grupo</span>`}
        ${apoyo ? `<span class="badge nic-apoyo" title="Necesita apoyo (monitor extra)">APOYO</span>` : ""}
      </div>
      <div class="nic-card-meta">
        <span>#${esc(n.nin_codnin || asoc.nic_codnin)} · ${esc(fecnacTxt)}</span>
      </div>
    </article>`;
  }

  function renderNinosCentroBoard() {
    const hint = document.getElementById("nic-hint");
    const pool = document.getElementById("nic-disponibles");
    const gruposEl = document.getElementById("nic-grupos");
    const countDisp = document.getElementById("count-nic-disp");
    const info = document.getElementById("nic-numgru-info");
    if (!pool || !gruposEl) return;

    if (!state.filtroCentroNic || !state.filtroPeriodoNic) {
      if (hint) hint.classList.remove("hidden");
      pool.innerHTML = `<p class="nic-empty">${
        !state.filtroCentroNic ? "Elige un centro arriba" : "Elige un periodo arriba"
      }</p>`;
      gruposEl.innerHTML = "";
      const headDisp0 = document.querySelector(".nic-pool .nic-col-head");
      if (headDisp0) {
        headDisp0.innerHTML = `<h3>Disponibles</h3><span class="card-count" id="count-nic-disp">0</span>`;
      }
      if (info) {
        info.hidden = true;
        info.textContent = "";
      }
      return;
    }
    if (hint) hint.classList.add("hidden");

    const fijos = gruposFijosCentro(state.filtroCentroNic);
    state.gruposCentro = fijos;
    if (info) {
      info.hidden = false;
      info.textContent = fijos.length
        ? `${fijos.length} grupos: ${fijos.join(" · ")}`
        : "Sin grupos asociados (configúralos en Centros por grupo)";
    }

    const disponibles = ninosDisponibles();
    const neeDisp = disponibles.filter((n) => ninoNecesitaApoyo(n, null)).length;
    const headDisp = document.querySelector(".nic-pool .nic-col-head");
    if (headDisp) {
      const h3 = headDisp.querySelector("h3");
      headDisp.innerHTML = `${h3 ? h3.outerHTML : "<h3>Disponibles</h3>"}${countBadgeHtml(
        disponibles.length,
        neeDisp
      )}`;
    }
    pool.innerHTML = disponibles.length
      ? disponibles.map((n) => cardNinoHtml(n, null)).join("")
      : `<p class="nic-empty">No hay niños libres<br/>(o no están en este periodo / búsqueda)</p>`;

    const byGrupo = {};
    fijos.forEach((g) => {
      byGrupo[g] = [];
    });
    const otros = [];
    const enPeriodo = idsNinosEnPeriodo(state.filtroPeriodoNic);
    state.ninosCent.forEach((a) => {
      if (!enPeriodo.has(a.nic_codnin)) return;
      const g = (a.nic_tipgru || "").trim();
      if (g && byGrupo[g]) byGrupo[g].push(a);
      else otros.push(a);
    });

    const cols = [...fijos];
    if (otros.length) cols.push("Otros");

    gruposEl.innerHTML = cols
      .map((g) => {
        const items = g === "Otros" ? otros : byGrupo[g];
        const droppable = g !== "Otros";
        const neeCount = items.filter((a) => {
          const n = state.ninos.find((x) => x.nin_codnin === a.nic_codnin);
          return ninoNecesitaApoyo(n, a);
        }).length;
        return `<section class="nic-grupo-col">
          <header class="nic-col-head">
            <h3>${esc(g)}</h3>
            ${countBadgeHtml(items.length, neeCount)}
          </header>
          <div class="nic-dropzone${droppable ? "" : " nic-dropzone-ro"}" data-zone="${droppable ? "grupo" : "otros"}" data-grupo="${esc(g)}">
            ${
              items.length
                ? items
                    .map((a) => {
                      const n = state.ninos.find((x) => x.nin_codnin === a.nic_codnin) || {
                        nin_codnin: a.nic_codnin,
                        nin_nomnin: a.nin_nomnin,
                        nin_fecnac: a.nin_fecnac,
                        nin_tipnin: a.nin_tipnin,
                        nin_apoyo: a.nin_apoyo,
                      };
                      return cardNinoHtml(n, a);
                    })
                    .join("")
                : `<p class="nic-empty">Suelta niños aquí</p>`
            }
          </div>
        </section>`;
      })
      .join("");

    bindNicDragDrop();
  }

  function bindNicDragDrop() {
    const board = document.getElementById("nic-board");
    if (!board) return;

    board.querySelectorAll(".nic-card").forEach((card) => {
      card.addEventListener("dragstart", (ev) => {
        card.classList.add("dragging");
        ev.dataTransfer.setData(
          "text/plain",
          JSON.stringify({
            kind: card.dataset.kind,
            id: Number(card.dataset.id),
            codnin: Number(card.dataset.codnin),
          })
        );
        ev.dataTransfer.effectAllowed = "move";
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
    });

    board.querySelectorAll(".nic-dropzone").forEach((zone) => {
      zone.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        zone.classList.add("drag-over");
        ev.dataTransfer.dropEffect = "move";
      });
      zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
      zone.addEventListener("drop", async (ev) => {
        ev.preventDefault();
        zone.classList.remove("drag-over");
        let payload;
        try {
          payload = JSON.parse(ev.dataTransfer.getData("text/plain") || "{}");
        } catch {
          return;
        }
        if (!payload || !payload.codnin) return;
        try {
          await handleNicDrop(payload, zone.dataset.zone, zone.dataset.grupo || "");
        } catch (err) {
          toast(err.message, "err");
        }
      });
    });

  }

  async function handleNicDrop(payload, zone, grupo) {
    if (!state.filtroCentroNic) {
      toast("Selecciona un centro primero", "err");
      return;
    }
    if (!state.filtroPeriodoNic) {
      toast("Selecciona un periodo primero", "err");
      return;
    }
    if (zone === "otros") {
      toast("Mueve el niño a un grupo válido del centro", "err");
      return;
    }
    if (zone === "pool") {
      if (payload.kind === "asig") {
        await api(`/api/ninos-cent/${payload.id}`, { method: "DELETE" });
        toast("Devuelto a disponibles");
      }
    } else if (zone === "grupo") {
      const tipgru = (grupo || "").trim();
      const permitidos = gruposFijosCentro(state.filtroCentroNic);
      if (!permitidos.includes(tipgru)) {
        toast("Grupo no válido para este centro", "err");
        return;
      }
      if (payload.kind === "disp") {
        await api("/api/ninos-cent", {
          method: "POST",
          body: JSON.stringify({
            nic_codnin: payload.codnin,
            nic_codcen: state.filtroCentroNic,
            nic_tipgru: tipgru,
          }),
        });
        await aplicarTipoNino(payload.codnin, tipgru);
        toast(`Asignado a ${tipgru}`);
      } else if (payload.kind === "asig") {
        await api(`/api/ninos-cent/${payload.id}`, {
          method: "PUT",
          body: JSON.stringify({ nic_tipgru: tipgru }),
        });
        await aplicarTipoNino(payload.codnin, tipgru);
        toast(`Movido a ${tipgru}`);
      }
    }
    await loadNinosCent(state.filtroCentroNic);
    renderNinosCentroBoard();
  }

  function fillFiltroCentrosMoc() {
    const sel = document.getElementById("filtro-centro-moc");
    if (!sel) return;
    const prev = state.filtroCentroMoc || sel.value;
    const activos = state.centros.filter((c) => !c.exi_fecbaj);
    sel.innerHTML =
      `<option value="">— Selecciona un centro —</option>` +
      activos
        .map((c) => `<option value="${esc(c.exi_codcen)}">${esc(c.exi_codcen)} — ${esc(c.exi_nomcen)}</option>`)
        .join("");
    if (prev && [...sel.options].some((o) => o.value === prev)) {
      sel.value = prev;
      state.filtroCentroMoc = prev;
    } else {
      state.filtroCentroMoc = "";
    }
  }

  async function ensureMonitoresGruposBoard(force = false) {
    const jobs = [];
    if (!state.centros.length || force) jobs.push(loadCentros());
    if (!state.monitores.length || force) jobs.push(loadMonitores());
    if (!state.ninos.length || force) jobs.push(loadNinos());
    if (!state.periodos.length || force) jobs.push(loadPeriodos());
    if (!state.ninosPeriodo.length || force) jobs.push(loadNinosPeriodo());
    if (!state.monitoresPeriodo.length || force) jobs.push(loadMonitoresPeriodo());
    if (jobs.length) await Promise.all(jobs);
    fillFiltroCentrosMoc();
    fillFiltroPeriodos("filtro-periodo-moc", "filtroPeriodoMoc");
    if (state.filtroCentroMoc) await loadMonitoresCent(state.filtroCentroMoc);
    else {
      state.monitoresCent = [];
      state.gruposMonitores = [];
      state.ninosCent = [];
    }
    renderMonitoresGruposBoard();
  }

  async function loadMonitoresCent(codcen) {
    const codper = state.filtroPeriodoMoc;
    const mocQs = new URLSearchParams({ codcen });
    if (codper) mocQs.set("codper", codper);
    const [asigs, grupos, ninosAsig] = await Promise.all([
      api(`/api/monitores-cent?${mocQs.toString()}`),
      api(`/api/tipos-grupos-centro?codcen=${encodeURIComponent(codcen)}`),
      api(`/api/ninos-cent?codcen=${encodeURIComponent(codcen)}`),
    ]);
    state.monitoresCent = asigs;
    state.ninosCent = ninosAsig;
    state.gruposMonitores = (grupos || [])
      .slice()
      .sort((a, b) => (a.tgc_ordgru || 0) - (b.tgc_ordgru || 0))
      .map((g) => g.tip_descri)
      .filter(Boolean);
    if (!state.gruposMonitores.length) {
      state.gruposMonitores = [...(GRUPOS_POR_NUM[numGruCentro(codcen)] || GRUPOS_POR_NUM[3])];
    }
  }

  function monitoresDisponiblesGrupo() {
    const assigned = new Set(
      state.monitoresCent
        .filter((a) => a.moc_codcen === state.filtroCentroMoc)
        .map((a) => a.moc_codmon)
    );
    const enPeriodo = idsMonitoresEnPeriodo(state.filtroPeriodoMoc);
    const q = (state.buscaMocDisp || "").trim().toLowerCase();
    return state.monitores.filter((m) => {
      if (m.mon_fecbaj) return false;
      if (m.mon_codcen !== state.filtroCentroMoc) return false;
      if (state.filtroPeriodoMoc && !enPeriodo.has(m.mon_codmon)) return false;
      if (assigned.has(m.mon_codmon)) return false;
      if (!q) return true;
      return [m.mon_codmon, m.mon_nommon, m.mon_tipmon, m.mon_ciumon].some((f) =>
        String(f ?? "")
          .toLowerCase()
          .includes(q)
      );
    });
  }

  function statsNinosGrupo(grupo) {
    const enPeriodo = idsNinosEnPeriodo(state.filtroPeriodoMoc);
    const kids = state.ninosCent.filter(
      (a) => (a.nic_tipgru || "").trim() === grupo && (!state.filtroPeriodoMoc || enPeriodo.has(a.nic_codnin))
    );
    let apoyo = 0;
    kids.forEach((a) => {
      const n = state.ninos.find((x) => x.nin_codnin === a.nic_codnin);
      if (ninoNecesitaApoyo(n, a)) apoyo += 1;
    });
    const base = kids.length > 0 ? 1 : 0;
    const extra = apoyo > 0 ? 1 : 0;
    return {
      ninos: kids.length,
      apoyo,
      recomendados: base + extra,
    };
  }

  function cardMonitorHtml(m, asoc) {
    const id = asoc ? asoc.moc_codmoc : m.mon_codmon;
    const kind = asoc ? "asig" : "disp";
    const nombre = asoc?.mon_nommon || m.mon_nommon;
    const tip = asoc?.mon_tipmon || m.mon_tipmon || "";
    const grupo = asoc?.moc_tipgru || "";
    return `<article class="nic-card" draggable="true" data-kind="${kind}" data-id="${id}" data-codmon="${m.mon_codmon || asoc.moc_codmon}">
      <div class="nic-card-top">
        <strong>${esc(nombre)}</strong>
        <span class="nic-edad">#${esc(m.mon_codmon || asoc.moc_codmon)}</span>
      </div>
      <div class="nic-card-tipo-row">
        ${tip ? `<span class="badge nic-tipo">${esc(tip)}</span>` : `<span class="badge nic-tipo off">Sin tipo</span>`}
        ${grupo ? `<span class="badge nic-tipo">${esc(grupo)}</span>` : ""}
      </div>
    </article>`;
  }

  function grupoHeadStatsHtml(stats, monitoresCount) {
    const falta = stats.recomendados > monitoresCount;
    const apoyoBadge =
      stats.apoyo > 0
        ? `<span class="card-count-apoyo" title="${stats.apoyo} niño(s) necesitan apoyo → +1 monitor">${stats.apoyo} apoyo</span>`
        : "";
    const kidsBadge = `<span class="moc-stat" title="Niños en el grupo">${stats.ninos} niños</span>`;
    const monBadge = `<span class="card-count${falta ? " moc-faltan" : ""}" title="Monitores asignados / recomendados">${monitoresCount}/${stats.recomendados}</span>`;
    return `<span class="card-count-wrap">${monBadge}${kidsBadge}${apoyoBadge}</span>`;
  }

  function renderMonitoresGruposBoard() {
    const hint = document.getElementById("moc-hint");
    const pool = document.getElementById("moc-disponibles");
    const gruposEl = document.getElementById("moc-grupos");
    const info = document.getElementById("moc-numgru-info");
    if (!pool || !gruposEl) return;

    if (!state.filtroCentroMoc || !state.filtroPeriodoMoc) {
      if (hint) hint.classList.remove("hidden");
      pool.innerHTML = `<p class="nic-empty">${
        !state.filtroCentroMoc ? "Elige un centro arriba" : "Elige un periodo arriba"
      }</p>`;
      gruposEl.innerHTML = "";
      const head0 = document.querySelector("#moc-board .nic-pool .nic-col-head");
      if (head0) head0.innerHTML = `<h3>Disponibles</h3><span class="card-count" id="count-moc-disp">0</span>`;
      if (info) {
        info.hidden = true;
        info.textContent = "";
      }
      return;
    }
    if (hint) hint.classList.add("hidden");

    const fijos = state.gruposMonitores.length
      ? [...state.gruposMonitores]
      : [...(GRUPOS_POR_NUM[numGruCentro(state.filtroCentroMoc)] || GRUPOS_POR_NUM[3])];
    if (info) {
      info.hidden = false;
      info.textContent = fijos.length
        ? `${fijos.length} grupos: ${fijos.join(" · ")}`
        : "Sin grupos asociados";
    }

    const disponibles = monitoresDisponiblesGrupo();
    const headDisp = document.querySelector("#moc-board .nic-pool .nic-col-head");
    if (headDisp) {
      headDisp.innerHTML = `<h3>Disponibles</h3>${countBadgeHtml(disponibles.length, 0)}`;
    }
    pool.innerHTML = disponibles.length
      ? disponibles.map((m) => cardMonitorHtml(m, null)).join("")
      : `<p class="nic-empty">No hay monitores libres<br/>de este centro en el periodo</p>`;

    const byGrupo = {};
    fijos.forEach((g) => {
      byGrupo[g] = [];
    });
    const otros = [];
    state.monitoresCent.forEach((a) => {
      const g = (a.moc_tipgru || "").trim();
      if (g && byGrupo[g]) byGrupo[g].push(a);
      else otros.push(a);
    });

    const cols = [...fijos];
    if (otros.length) cols.push("Otros");

    gruposEl.innerHTML = cols
      .map((g) => {
        const items = g === "Otros" ? otros : byGrupo[g];
        const droppable = g !== "Otros";
        const stats = g === "Otros" ? { ninos: 0, apoyo: 0, recomendados: 0 } : statsNinosGrupo(g);
        const alerta =
          droppable && stats.recomendados > items.length
            ? `<p class="moc-alerta">Falta monitor${stats.apoyo ? " (hay apoyo)" : ""}</p>`
            : "";
        return `<section class="nic-grupo-col${
          droppable && stats.recomendados > items.length ? " moc-col-alerta" : ""
        }">
          <header class="nic-col-head">
            <h3>${esc(g)}</h3>
            ${grupoHeadStatsHtml(stats, items.length)}
          </header>
          ${alerta}
          <div class="nic-dropzone${droppable ? "" : " nic-dropzone-ro"}" data-zone="${
            droppable ? "grupo" : "otros"
          }" data-grupo="${esc(g)}">
            ${
              items.length
                ? items
                    .map((a) => {
                      const m = state.monitores.find((x) => x.mon_codmon === a.moc_codmon) || {
                        mon_codmon: a.moc_codmon,
                        mon_nommon: a.mon_nommon,
                        mon_tipmon: a.mon_tipmon,
                      };
                      return cardMonitorHtml(m, a);
                    })
                    .join("")
                : `<p class="nic-empty">Suelta monitores aquí</p>`
            }
          </div>
        </section>`;
      })
      .join("");

    bindMocDragDrop();
  }

  function bindMocDragDrop() {
    const board = document.getElementById("moc-board");
    if (!board) return;

    board.querySelectorAll(".nic-card").forEach((card) => {
      card.addEventListener("dragstart", (ev) => {
        card.classList.add("dragging");
        ev.dataTransfer.setData(
          "text/plain",
          JSON.stringify({
            kind: card.dataset.kind,
            id: Number(card.dataset.id),
            codmon: Number(card.dataset.codmon),
          })
        );
        ev.dataTransfer.effectAllowed = "move";
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
    });

    board.querySelectorAll(".nic-dropzone").forEach((zone) => {
      zone.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        zone.classList.add("drag-over");
        ev.dataTransfer.dropEffect = "move";
      });
      zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
      zone.addEventListener("drop", async (ev) => {
        ev.preventDefault();
        zone.classList.remove("drag-over");
        let payload;
        try {
          payload = JSON.parse(ev.dataTransfer.getData("text/plain") || "{}");
        } catch {
          return;
        }
        if (!payload || !payload.codmon) return;
        try {
          await handleMocDrop(payload, zone.dataset.zone, zone.dataset.grupo || "");
        } catch (err) {
          toast(err.message, "err");
        }
      });
    });
  }

  async function handleMocDrop(payload, zone, grupo) {
    if (!state.filtroCentroMoc) {
      toast("Selecciona un centro primero", "err");
      return;
    }
    if (!state.filtroPeriodoMoc) {
      toast("Selecciona un periodo primero", "err");
      return;
    }
    if (zone === "otros") {
      toast("Mueve el monitor a un grupo válido del centro", "err");
      return;
    }
    if (zone === "pool") {
      if (payload.kind === "asig") {
        await api(`/api/monitores-cent/${payload.id}`, { method: "DELETE" });
        toast("Devuelto a disponibles");
      }
    } else if (zone === "grupo") {
      const tipgru = (grupo || "").trim();
      const permitidos = state.gruposMonitores.length
        ? state.gruposMonitores
        : GRUPOS_POR_NUM[numGruCentro(state.filtroCentroMoc)] || GRUPOS_POR_NUM[3];
      if (!permitidos.includes(tipgru)) {
        toast("Grupo no válido para este centro", "err");
        return;
      }
      if (payload.kind === "disp") {
        await api("/api/monitores-cent", {
          method: "POST",
          body: JSON.stringify({
            moc_codmon: payload.codmon,
            moc_codcen: state.filtroCentroMoc,
            moc_tipgru: tipgru,
            moc_codper: state.filtroPeriodoMoc,
          }),
        });
        toast(`Monitor asignado a ${tipgru}`);
      } else if (payload.kind === "asig") {
        await api(`/api/monitores-cent/${payload.id}`, {
          method: "PUT",
          body: JSON.stringify({ moc_tipgru: tipgru }),
        });
        toast(`Monitor movido a ${tipgru}`);
      }
    }
    await loadMonitoresCent(state.filtroCentroMoc);
    renderMonitoresGruposBoard();
  }

  async function ensureLookups() {
    if (!state.centros.length) {
      state.centros = await api("/api/centros");
      fillFiltroCentros();
    }
  }

  function renderMonitores() {
    const tbody = document.querySelector("#tabla-monitores tbody");
    const rows = state.monitores.filter((m) =>
      matchSearch([
        m.mon_codmon,
        m.mon_nommon,
        m.mon_codusr,
        m.mon_codcen,
        m.mon_ciumon,
        m.mon_tipmon,
        m.mon_usrcre,
      ])
    );
    document.getElementById("count-monitores").textContent = String(rows.length);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="empty-state">No hay monitores</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map((m) => {
        const baja = Boolean(m.mon_fecbaj);
        return `<tr>
          <td><strong>${esc(m.mon_codmon)}</strong></td>
          <td>${esc(m.mon_nommon)}</td>
          <td>${esc(m.mon_codusr || "—")}</td>
          <td>${esc(m.mon_codcen)}</td>
          <td>${esc(m.mon_ciumon || "—")}</td>
          <td>${tipMonitorBadge(m.mon_tipmon)}</td>
          <td>${esc(m.mon_usrcre || "—")}</td>
          <td>${esc(fmtDate(m.mon_feccre))}</td>
          <td>${baja ? '<span class="badge off">Baja</span>' : '<span class="badge ok">Activo</span>'}</td>
          <td class="row-actions">${monitorActionButtons(m)}</td>
        </tr>`;
      })
      .join("");
    bindMonitorActions(tbody, loadMonitores);
  }

  function renderMonitoresCentro() {
    const tbody = document.querySelector("#tabla-monitores-centro tbody");
    const countEl = document.getElementById("count-monitores-centro");
    const titulo = document.querySelector("#sec-monitores-centro .card-head h2");

    if (!state.verTodosMonCen && !state.filtroCentroMon) {
      countEl.textContent = "0";
      if (titulo) titulo.textContent = "Monitores del centro";
      tbody.innerHTML = `<tr><td colspan="10" class="empty-state">Selecciona un centro o pulsa Ver todos</td></tr>`;
      return;
    }

    let rows;
    if (state.verTodosMonCen) {
      if (titulo) titulo.textContent = "Monitores · todos los centros";
      rows = state.monitores.filter((m) =>
        matchSearch([m.mon_codmon, m.mon_nommon, m.mon_codusr, m.mon_codcen, m.mon_ciumon, m.mon_tipmon, m.mon_usrcre])
      );
    } else {
      const centro = state.centros.find((c) => c.exi_codcen === state.filtroCentroMon);
      if (titulo) {
        titulo.textContent = centro
          ? `Monitores · ${centro.exi_codcen} — ${centro.exi_nomcen}`
          : "Monitores del centro";
      }
      rows = state.monitores.filter(
        (m) =>
          m.mon_codcen === state.filtroCentroMon &&
          matchSearch([m.mon_codmon, m.mon_nommon, m.mon_codusr, m.mon_codcen, m.mon_ciumon, m.mon_tipmon, m.mon_usrcre])
      );
    }

    countEl.textContent = String(rows.length);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="empty-state">No hay monitores${state.verTodosMonCen ? "" : " en este centro"}</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map((m) => {
        const baja = Boolean(m.mon_fecbaj);
        return `<tr>
          <td><strong>${esc(m.mon_codmon)}</strong></td>
          <td>${esc(m.mon_nommon)}</td>
          <td>${esc(m.mon_codusr || "—")}</td>
          <td>${esc(m.mon_codcen)}</td>
          <td>${esc(m.mon_ciumon || "—")}</td>
          <td>${tipMonitorBadge(m.mon_tipmon)}</td>
          <td>${esc(m.mon_usrcre || "—")}</td>
          <td>${esc(fmtDate(m.mon_feccre))}</td>
          <td>${baja ? '<span class="badge off">Baja</span>' : '<span class="badge ok">Activo</span>'}</td>
          <td class="row-actions">${monitorActionButtons(m)}</td>
        </tr>`;
      })
      .join("");
    bindMonitorActions(tbody, loadMonitores);
  }

  let mapInstance = null;

  function puntosConGps(lista) {
    return (lista || []).filter((c) => {
      const lat = Number(c.exi_latgps);
      const lng = Number(c.exi_longgps);
      return Number.isFinite(lat) && Number.isFinite(lng);
    });
  }

  function openMapaCentros(focusCentro) {
    if (typeof L === "undefined") {
      toast("No se pudo cargar el mapa (Leaflet).", "err");
      return;
    }

    const mapModal = document.getElementById("map-modal");
    const titleEl = document.getElementById("map-title");
    const canvas = document.getElementById("map-canvas");

    const puntos = focusCentro
      ? puntosConGps([focusCentro])
      : puntosConGps(state.centros.filter((c) => !c.exi_fecbaj));

    if (!puntos.length) {
      toast(
        focusCentro
          ? "Este centro no tiene latitud/longitud válidas."
          : "No hay centros activos con coordenadas GPS.",
        "err"
      );
      return;
    }

    titleEl.textContent = focusCentro
      ? `Mapa · ${focusCentro.exi_codcen} — ${focusCentro.exi_nomcen}`
      : `Mapa de centros (${puntos.length})`;

    mapModal.classList.remove("hidden");

    requestAnimationFrame(() => {
      if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
      }
      mapInstance = L.map(canvas);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(mapInstance);

      const bounds = [];
      puntos.forEach((c) => {
        const lat = Number(c.exi_latgps);
        const lng = Number(c.exi_longgps);
        bounds.push([lat, lng]);
        const marker = L.marker([lat, lng]).addTo(mapInstance);
        marker.bindPopup(
          `<strong>${esc(c.exi_codcen)}</strong><br>${esc(c.exi_nomcen)}` +
            (c.exi_nompob ? `<br>${esc(c.exi_nompob)}` : "") +
            `<br><small>${lat}, ${lng}</small>`
        );
        if (focusCentro && c.exi_codcen === focusCentro.exi_codcen) {
          marker.openPopup();
        }
      });

      if (bounds.length === 1) {
        mapInstance.setView(bounds[0], 14);
      } else {
        mapInstance.fitBounds(bounds, { padding: [40, 40] });
      }
      setTimeout(() => mapInstance.invalidateSize(), 80);
    });
  }

  function closeMapModal() {
    document.getElementById("map-modal").classList.add("hidden");
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  }

  document.getElementById("map-close").addEventListener("click", closeMapModal);
  document.getElementById("map-backdrop").addEventListener("click", closeMapModal);

  document.getElementById("btn-form-mapa").addEventListener("click", () => {
    const lat = numOrNull(document.getElementById("f-exi_latgps")?.value);
    const lng = numOrNull(document.getElementById("f-exi_longgps")?.value);
    const cod = document.getElementById("f-exi_codcen")?.value || "preview";
    const nom = document.getElementById("f-exi_nomcen")?.value || "Centro";
    const pob = document.getElementById("f-exi_nompob")?.value || null;
    if (lat == null || lng == null) {
      toast("Indica latitud y longitud para ver el punto en el mapa.", "err");
      return;
    }
    openMapaCentros({
      exi_codcen: cod,
      exi_nomcen: nom,
      exi_latgps: lat,
      exi_longgps: lng,
      exi_nompob: pob,
    });
  });

  function openModal(title, fieldsHtml, onSubmit, opts = {}) {
    if (typeof ExiDates !== "undefined") ExiDates.destroy(els.modalForm);
    els.modalTitle.textContent = title;
    els.modalForm.innerHTML = fieldsHtml.join("");
    els.modalMsg.textContent = "";
    els.modalMsg.className = "message";
    const mapBtn = document.getElementById("btn-form-mapa");
    mapBtn.classList.toggle("hidden", !opts.showMap);
    els.modal.classList.remove("hidden");
    if (typeof ExiDates !== "undefined") ExiDates.bind(els.modalForm);
    els.modalForm.onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(els.modalForm);
      const data = Object.fromEntries(fd.entries());
      els.modalForm.querySelectorAll("[disabled][name]").forEach((el) => {
        data[el.name] = el.value;
      });
      els.modalForm.querySelectorAll('input[type="checkbox"][name]').forEach((el) => {
        data[el.name] = el.checked;
      });
      // Asegura ISO yyyy-mm-dd en campos de fecha
      els.modalForm.querySelectorAll("input.exi-date[name]").forEach((el) => {
        const iso =
          typeof ExiDates !== "undefined" ? ExiDates.toIsoDate(el.value) : el.value;
        data[el.name] = iso;
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

  function openCentroModal(existing) {
    const isEdit = Boolean(existing);
    // 3 por línea: código | nombre | población ; lat | long | capacidad ; descripción full
    openModal(
      isEdit ? "Editar centro" : "Nuevo centro",
      [
        field("exi_codcen", "Código", existing?.exi_codcen || "", { required: true, disabled: isEdit, maxlength: 20 }),
        field("exi_nomcen", "Nombre", existing?.exi_nomcen || "", { required: true, maxlength: 200 }),
        field("exi_nompob", "Población", existing?.exi_nompob || "", { maxlength: 200 }),
        field("exi_latgps", "Latitud GPS", existing?.exi_latgps ?? "", { type: "number", step: "any" }),
        field("exi_longgps", "Longitud GPS", existing?.exi_longgps ?? "", { type: "number", step: "any" }),
        field("exi_capaci", "Capacidad", existing?.exi_capaci ?? "", { type: "number", step: "1" }),
        selectField(
          "exi_numgru",
          "Nº grupos",
          [
            { value: "3", label: "3 — PEQUEÑOS, MEDIANOS, MAYORES" },
            { value: "4", label: "4 — PEQUEÑOS 1, PEQUEÑOS 2, MEDIANOS, MAYORES" },
          ],
          { value: String(existing?.exi_numgru === 4 ? 4 : 3), required: true }
        ),
        ...(isEdit
          ? [
              field("cen_usrcre", "Creado por", existing?.cen_usrcre || "", { disabled: true }),
              field("cen_feccre", "Fecha creación", existing?.cen_feccre ? fmtDate(existing.cen_feccre) : "", {
                disabled: true,
                span: 2,
              }),
            ]
          : []),
        textareaField("exi_descen", "Descripción", existing?.exi_descen || "", { maxlength: 1000, rows: 4, span: 3 }),
      ],
      async (data) => {
        const body = {
          exi_nomcen: data.exi_nomcen,
          exi_latgps: numOrNull(data.exi_latgps),
          exi_longgps: numOrNull(data.exi_longgps),
          exi_nompob: data.exi_nompob || null,
          exi_capaci: numOrNull(data.exi_capaci),
          exi_numgru: Number(data.exi_numgru) === 4 ? 4 : 3,
          exi_descen: data.exi_descen || null,
        };
        if (isEdit) {
          await api(`/api/centros/${encodeURIComponent(existing.exi_codcen)}`, {
            method: "PUT",
            body: JSON.stringify(body),
          });
          toast("Centro actualizado");
        } else {
          await api("/api/centros", {
            method: "POST",
            body: JSON.stringify({ exi_codcen: data.exi_codcen, ...body }),
          });
          toast("Centro creado");
        }
        await loadCentros();
      },
      { showMap: true }
    );
  }

  async function openMonitorModal(existing, opts = {}) {
    try {
      await ensureLookups();
    } catch (err) {
      toast(err.message, "err");
      return;
    }
    const isEdit = Boolean(existing);
    const fixedCodcen = opts.fixedCodcen || null;
    const tieneUsuario = Boolean(existing?.mon_codusr);
    const centrosActivos = state.centros.filter((c) => !c.exi_fecbaj);
    const cenOpts = [
      { value: "", label: "— Seleccionar centro —" },
      ...centrosActivos.map((c) => ({
        value: c.exi_codcen,
        label: `${c.exi_codcen} — ${c.exi_nomcen}`,
      })),
    ];
    const codcenInicial = fixedCodcen || existing?.mon_codcen || "";
    if (codcenInicial && !cenOpts.some((o) => o.value === codcenInicial)) {
      const baja = state.centros.find((c) => c.exi_codcen === codcenInicial);
      cenOpts.push({
        value: codcenInicial,
        label: baja ? `${baja.exi_codcen} — ${baja.exi_nomcen} (baja)` : codcenInicial,
      });
    }
    const tipOpts = TIPOS_MONITOR.map((t) => ({ ...t }));
    if (isEdit && existing.mon_tipmon && !tipOpts.some((o) => o.value === existing.mon_tipmon)) {
      tipOpts.push({ value: existing.mon_tipmon, label: existing.mon_tipmon });
    }

    // Usuario opcional: se crea para este monitor (nunca se elige otro existente).
    let camposUsuario;
    if (tieneUsuario) {
      camposUsuario = [
        field("mon_codusr", "Usuario", existing.mon_codusr, { disabled: true }),
      ];
    } else {
      camposUsuario = [
        field("usr_codusr", "Código usuario (opcional)", "", {
          maxlength: 20,
          placeholder: "Vacío = sin acceso al sistema",
        }),
        field("usr_pass", "Contraseña", "", {
          type: "password",
          maxlength: 200,
          placeholder: "Solo si creas usuario",
        }),
        field("usr_email", "Email", "", { type: "email", maxlength: 200 }),
        field("usr_descri", "Descripción usuario", "", { maxlength: 200 }),
      ];
    }

    openModal(
      isEdit ? "Editar monitor" : fixedCodcen ? "Nuevo monitor del centro" : "Nuevo monitor",
      [
        ...(isEdit
          ? [field("mon_codmon", "Código", existing.mon_codmon, { disabled: true })]
          : []),
        field("mon_nommon", "Nombre", existing?.mon_nommon || "", { required: true, maxlength: 200 }),
        ...camposUsuario,
        selectField("mon_codcen", "Centro", cenOpts, {
          required: true,
          value: codcenInicial,
          disabled: Boolean(fixedCodcen),
        }),
        field("mon_ciumon", "Ciudad", existing?.mon_ciumon || "", { maxlength: 200 }),
        selectField("mon_tipmon", "Tipo (INTERNO / BECARIO)", tipOpts, {
          value: existing?.mon_tipmon || "",
          required: true,
        }),
        ...(isEdit
          ? [
              field("mon_usrcre", "Creado por", existing?.mon_usrcre || "", { disabled: true }),
              field("mon_feccre", "Fecha creación", existing?.mon_feccre ? fmtDate(existing.mon_feccre) : "", {
                disabled: true,
              }),
            ]
          : []),
      ],
      async (data) => {
        const bodyMonitor = {
          mon_nommon: data.mon_nommon,
          mon_codcen: fixedCodcen || data.mon_codcen,
          mon_ciumon: data.mon_ciumon || null,
          mon_tipmon: data.mon_tipmon || null,
        };
        if (!bodyMonitor.mon_tipmon || !["INTERNO", "BECARIO"].includes(bodyMonitor.mon_tipmon)) {
          throw new Error("Selecciona el tipo: INTERNO o BECARIO");
        }
        const crearUsr = !tieneUsuario && String(data.usr_codusr || "").trim();
        if (crearUsr) {
          bodyMonitor.usr_codusr = String(data.usr_codusr).trim();
          bodyMonitor.usr_pass = data.usr_pass || "";
          bodyMonitor.usr_name = data.mon_nommon;
          bodyMonitor.usr_email = data.usr_email || null;
          bodyMonitor.usr_descri = data.usr_descri || null;
        }

        if (isEdit) {
          await api(`/api/monitores/${existing.mon_codmon}`, {
            method: "PUT",
            body: JSON.stringify(bodyMonitor),
          });
          toast(crearUsr ? "Monitor actualizado y usuario creado" : "Monitor actualizado");
        } else {
          await api("/api/monitores", {
            method: "POST",
            body: JSON.stringify(bodyMonitor),
          });
          toast(crearUsr ? "Monitor y usuario creados" : "Monitor creado (sin usuario)");
        }
        await loadMonitores();
      },
      { showMap: false }
    );
  }

  document.getElementById("filtro-centro-mon").addEventListener("change", (ev) => {
    state.filtroCentroMon = ev.target.value;
    state.verTodosMonCen = false;
    renderMonitoresCentro();
  });

  document.getElementById("btn-ver-todos-mon").addEventListener("click", () => {
    state.verTodosMonCen = true;
    state.filtroCentroMon = "";
    const sel = document.getElementById("filtro-centro-mon");
    if (sel) sel.value = "";
    renderMonitoresCentro();
    toast("Mostrando monitores de todos los centros");
  });

  document.getElementById("btn-descargar-mon-cen").addEventListener("click", () => {
    if (!state.verTodosMonCen && !state.filtroCentroMon) {
      toast("Selecciona un centro o pulsa Ver todos antes de descargar", "err");
      return;
    }
    downloadTableCsv("#tabla-monitores-centro", "exi_monitores_por_centro");
  });

  document.getElementById("filtro-centro-tgc").addEventListener("change", async (ev) => {
    state.filtroCentroTgc = ev.target.value;
    state.verTodosTgc = false;
    try {
      await loadTiposGruposCentro();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  document.getElementById("btn-ver-todos-tgc").addEventListener("click", async () => {
    state.verTodosTgc = true;
    state.filtroCentroTgc = "";
    const sel = document.getElementById("filtro-centro-tgc");
    if (sel) sel.value = "";
    try {
      await loadTiposGruposCentro();
      toast("Mostrando grupos de todos los centros");
    } catch (err) {
      toast(err.message, "err");
    }
  });

  document.getElementById("btn-descargar-tgc").addEventListener("click", () => {
    if (!state.verTodosTgc && !state.filtroCentroTgc) {
      toast("Selecciona un centro o pulsa Ver todos antes de descargar", "err");
      return;
    }
    downloadTableCsv("#tabla-grupos-centro", "exi_tipo_grupos_centro");
  });

  document.getElementById("filtro-centro-moc").addEventListener("change", async (ev) => {
    state.filtroCentroMoc = ev.target.value;
    try {
      if (state.filtroCentroMoc) await loadMonitoresCent(state.filtroCentroMoc);
      else {
        state.monitoresCent = [];
        state.gruposMonitores = [];
      }
      renderMonitoresGruposBoard();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  document.getElementById("filtro-periodo-moc").addEventListener("change", async (ev) => {
    state.filtroPeriodoMoc = ev.target.value;
    try {
      if (state.filtroCentroMoc) await loadMonitoresCent(state.filtroCentroMoc);
      else {
        state.monitoresCent = [];
        state.gruposMonitores = [];
      }
      renderMonitoresGruposBoard();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  document.getElementById("busca-moc-disp").addEventListener("input", (ev) => {
    state.buscaMocDisp = ev.target.value.trim().toLowerCase();
    renderMonitoresGruposBoard();
  });

  document.getElementById("btn-descargar-moc").addEventListener("click", () => {
    if (!state.filtroCentroMoc) {
      toast("Selecciona un centro antes de descargar", "err");
      return;
    }
    if (!state.filtroPeriodoMoc) {
      toast("Selecciona un periodo antes de descargar", "err");
      return;
    }
    const rows = state.monitoresCent.map((a) => ({
      moc_codmoc: a.moc_codmoc,
      moc_codmon: a.moc_codmon,
      mon_nommon: a.mon_nommon,
      moc_codcen: a.moc_codcen,
      moc_tipgru: a.moc_tipgru,
      moc_codper: a.moc_codper,
    }));
    const header = ["moc_codmoc", "moc_codmon", "mon_nommon", "moc_codcen", "moc_tipgru", "moc_codper"];
    const csv = [
      header.join(";"),
      ...rows.map((r) => header.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(";")),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `exi_monitores_centro_${state.filtroCentroMoc}_${state.filtroPeriodoMoc}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById("filtro-centro-nic").addEventListener("change", async (ev) => {
    state.filtroCentroNic = ev.target.value;
    try {
      if (state.filtroCentroNic) await loadNinosCent(state.filtroCentroNic);
      else {
        state.ninosCent = [];
        state.gruposCentro = [];
      }
      renderNinosCentroBoard();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  document.getElementById("filtro-periodo-nic").addEventListener("change", () => {
    state.filtroPeriodoNic = document.getElementById("filtro-periodo-nic").value;
    renderNinosCentroBoard();
  });

  document.getElementById("busca-nic-disp").addEventListener("input", (ev) => {
    state.buscaNicDisp = ev.target.value.trim().toLowerCase();
    renderNinosCentroBoard();
  });

  document.getElementById("chk-solo-sin-grupo").addEventListener("change", (ev) => {
    state.soloSinGrupo = Boolean(ev.target.checked);
    renderNinosCentroBoard();
  });

  document.getElementById("btn-descargar-nic").addEventListener("click", () => {
    if (!state.filtroCentroNic) {
      toast("Selecciona un centro antes de descargar", "err");
      return;
    }
    const rows = state.ninosCent.map((a) => ({
      nic_codnic: a.nic_codnic,
      nic_codnin: a.nic_codnin,
      nin_nomnin: a.nin_nomnin,
      nin_tipnin: a.nin_tipnin,
      nic_codcen: a.nic_codcen,
      nic_tipgru: a.nic_tipgru,
    }));
    const header = ["nic_codnic", "nic_codnin", "nin_nomnin", "nin_tipnin", "nic_codcen", "nic_tipgru"];
    const csv = [
      header.join(";"),
      ...rows.map((r) => header.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(";")),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `exi_ninos_cent_${state.filtroCentroNic}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  switchSection(state.section);
  Promise.all([
    loadPeriodos(),
    loadCentros(),
    loadMonitores(),
    loadNinos(),
    loadTiposGrupo(),
    loadNinosPeriodo(),
    loadMonitoresPeriodo(),
    loadDescuentos(),
    loadPrecios(),
  ]).catch((err) => toast(err.message, "err"));
})();
