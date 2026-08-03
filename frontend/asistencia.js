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
    section: "ninos-asistencia",
    periodos: [],
    ninosPeriodo: [],
    asistenciaLista: [],
    asistenciaMensual: null,
    eventosMes: {},
    filtroFechaAsi: "",
    filtroGrupoAsi: "",
    filtroGrupoMesAsi: "",
    filtroMesAsi: "",
    mostrarMetaAsi: false,
    search: "",
  };

  const els = {
    userLabel: document.getElementById("user-label"),
    search: document.getElementById("global-search"),
    pillRow: document.getElementById("pill-row"),
    toast: document.getElementById("toast"),
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

  if (isGeneral) {
    const menuGeneral = document.getElementById("menu-general");
    menuGeneral.classList.remove("hidden");
    setupSideFlyout({
      group: menuGeneral,
      button: document.getElementById("btn-menu-general"),
      flyout: document.getElementById("flyout-general"),
    });
  }

  setupSideFlyout({
    group: document.getElementById("menu-asistencia"),
    button: document.getElementById("btn-menu-asistencia"),
    flyout: document.getElementById("flyout-asistencia"),
    onSelect: (section) => {
      if (section) switchSection(section);
    },
  });

  els.search.addEventListener("input", () => {
    state.search = els.search.value.trim().toLowerCase();
    renderActive();
  });

  const SECTIONS = ["ninos-asistencia", "asistencia-mensual"];
  const hashSection = (location.hash || "").replace("#", "");
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
      const msg = typeof detail === "string" ? detail : data.message || `Error ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  function toast(msg, kind = "ok") {
    els.toast.textContent = msg;
    els.toast.classList.remove("hidden", "ok", "err");
    els.toast.classList.add(kind === "err" ? "err" : "ok");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.add("hidden"), 2800);
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function matchSearch(fields) {
    if (!state.search) return true;
    return fields.some((f) =>
      String(f ?? "")
        .toLowerCase()
        .includes(state.search)
    );
  }

  function filasAsistenciaVisibles(extraFilter = null) {
    return (state.asistenciaLista || []).filter((r) => {
      if (state.filtroGrupoAsi && String(r.asi_tipgru || "").trim() !== state.filtroGrupoAsi) return false;
      if (extraFilter && !extraFilter(r)) return false;
      return matchSearch([
        r.asi_codnin,
        r.nin_nomnin,
        r.asi_tipgru,
        r.asi_codcen,
        r.exi_nomcen,
        r.estado,
        r.nin_comali,
        r.asi_usrcre,
        r.usr_name,
      ]);
    });
  }

  function syncFiltroGrupoOptions() {
    const sel = document.getElementById("filtro-grupo-asi");
    if (!sel) return;
    const grupos = [
      ...new Set(
        (state.asistenciaLista || [])
          .map((r) => String(r.asi_tipgru || "").trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
    const actual = state.filtroGrupoAsi || "";
    sel.innerHTML =
      `<option value="">Todos</option>` +
      grupos.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
    if (actual && grupos.includes(actual)) sel.value = actual;
    else {
      sel.value = "";
      state.filtroGrupoAsi = "";
    }
  }

  function fmtDateOnly(value) {
    if (!value) return "—";
    if (window.ExiDates?.toEsDate) return window.ExiDates.toEsDate(value) || "—";
    const s = String(value).slice(0, 10);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
  }

  function weekdayNameEs(value) {
    const s = String(value || "").slice(0, 10);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return "";
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (Number.isNaN(d.getTime())) return "";
    const names = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    return names[d.getDay()] || "";
  }

  function syncWeekdayLabel() {
    const el = document.getElementById("asi-weekday-label");
    if (!el) return;
    const name = state.filtroFechaAsi ? weekdayNameEs(state.filtroFechaAsi) : "";
    el.textContent = name || "";
    el.hidden = !name;
    el.classList.toggle("asi-weekday-weekend", name === "Sábado" || name === "Domingo");
  }

  function syncMetaAsiVisibility() {
    const table = document.getElementById("tabla-ninos-asistencia");
    const btn = document.getElementById("btn-toggle-meta-asi");
    const show = Boolean(state.mostrarMetaAsi);
    if (table) table.classList.toggle("asi-hide-meta", !show);
    if (btn) {
      btn.setAttribute("aria-pressed", show ? "true" : "false");
      btn.textContent = show ? "Ocultar registro" : "Ver registro";
    }
  }

  function colspanDiaria() {
    return state.mostrarMetaAsi ? 8 : 6;
  }

  function hoyIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function switchSection(name) {
    if (!SECTIONS.includes(name)) name = "ninos-asistencia";
    state.section = name;
    history.replaceState(null, "", `#${name}`);
    document.querySelectorAll("#flyout-asistencia .flyout-link[data-section]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.section === name);
    });
    document.querySelectorAll(".admin-section").forEach((sec) => {
      sec.classList.toggle("hidden", sec.dataset.section !== name);
    });
    renderPills();
    ensureActive().catch((err) => toast(err.message, "err"));
  }

  async function ensureActive(force = false) {
    if (state.section === "ninos-asistencia") await ensureNinosAsistencia(force);
    if (state.section === "asistencia-mensual") await ensureAsistenciaMensual(force);
  }

  function fmtDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function estadoLabel(estado) {
    if (estado === "comedor") return "Ha venido y come";
    if (estado === "asiste") return "Ha venido";
    return "Falta";
  }

  function renderPills() {
    els.pillRow.innerHTML = "";
    const items =
      state.section === "asistencia-mensual"
        ? [
            {
              label: "Actualizar",
              className: "pill-btn ghost",
              action: () =>
                ensureAsistenciaMensual(true)
                  .then(() => toast("Resumen mensual actualizado"))
                  .catch((err) => toast(err.message, "err")),
            },
            {
              label: "Informe PDF",
              className: "pill-btn solid",
              html: `<span class="pill-ico" aria-hidden="true">⬇</span> Informe PDF`,
              action: () => exportAsistenciaMensualPdf(),
            },
          ]
        : [
            {
              label: "Actualizar",
              className: "pill-btn ghost",
              action: () =>
                ensureNinosAsistencia(true)
                  .then(() => toast("Asistencia diaria actualizada"))
                  .catch((err) => toast(err.message, "err")),
            },
            {
              label: "Informe PDF",
              className: "pill-btn solid",
              html: `<span class="pill-ico" aria-hidden="true">⬇</span> Informe PDF`,
              action: () => exportAsistenciaPdf(),
            },
          ];
    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = item.className;
      if (item.html) btn.innerHTML = item.html;
      else btn.textContent = item.label;
      btn.addEventListener("click", item.action);
      els.pillRow.appendChild(btn);
    });
    els.search.placeholder =
      state.section === "asistencia-mensual" ? "Buscar niño en resumen mensual…" : "Buscar niño en asistencia…";
  }

  function exportAsistenciaPdf() {
    if (!state.filtroFechaAsi) {
      toast("Selecciona un día antes de generar el PDF", "err");
      return;
    }
    const rows = filasAsistenciaVisibles();
    if (!rows.length) {
      toast("No hay datos para el informe PDF", "err");
      return;
    }
    const vienen = rows.filter((r) => r.estado === "asiste" || r.estado === "comedor").length;
    const comen = rows.filter((r) => r.estado === "comedor").length;
    const faltan = rows.length - vienen;
    const grupoTxt = state.filtroGrupoAsi ? ` · Grupo ${state.filtroGrupoAsi}` : "";
    downloadMatrixPdf({
      filename: `exi_asistencia_${state.filtroFechaAsi}${state.filtroGrupoAsi ? `_${state.filtroGrupoAsi}` : ""}`,
      title: "Asistencia diaria",
      subtitle: `Fecha ${fmtDateOnly(state.filtroFechaAsi)}${grupoTxt} · ${vienen} vienen · ${comen} comen · ${faltan} faltan`,
      headers: ["Niño", "Grupo", "Centro", "Viene", "Come", "Alimentación", "Registrado por", "Fecha registro"],
      rows: rows.map((r) => {
        const estado = r.estado || (r.asi_comedor ? "comedor" : r.asi_asist ? "asiste" : "no");
        const viene = estado === "asiste" || estado === "comedor";
        const come = estado === "comedor";
        return [
          `${r.nin_nomnin || ""} (#${r.asi_codnin})`,
          r.asi_tipgru || "",
          r.exi_nomcen || r.asi_codcen || "",
          viene ? "Sí" : "",
          come ? "Sí" : "",
          r.nin_comali || "",
          r.usr_name || r.asi_usrcre || "",
          r.asi_feccre ? fmtDateTime(r.asi_feccre) : "",
        ];
      }),
    });
    toast("Informe PDF descargado");
  }

  function marcaDiaMensual(d) {
    if (!d) return "";
    if (d.comedor) return "VC";
    if (d.asist) return "V";
    return "";
  }

  /** Letras ES: L M X J V S D (0=domingo … 6=sábado) */
  const LETRAS_DIA = ["D", "L", "M", "X", "J", "V", "S"];

  function dowMes(anio, mes, dia) {
    return new Date(anio, mes - 1, dia).getDay();
  }

  function esFinDeSemana(anio, mes, dia) {
    const dow = dowMes(anio, mes, dia);
    return dow === 0 || dow === 6;
  }

  function etiquetaDiaMes(anio, mes, dia) {
    return `${dia}-${LETRAS_DIA[dowMes(anio, mes, dia)] || "?"}`;
  }

  function diasLaborablesMes(anio, mes, diasMes) {
    const out = [];
    for (let d = 1; d <= diasMes; d += 1) {
      if (!esFinDeSemana(anio, mes, d)) out.push(d);
    }
    return out;
  }

  function esDiaFuturo(anio, mes, dia) {
    const hoy = hoyIso();
    const iso = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    return iso > hoy;
  }

  function claseCeldaMensual(anio, mes, dia, marca, tieneEvento = false, enPeriodo = true) {
    const fin = esFinDeSemana(anio, mes, dia);
    const futuro = esDiaFuturo(anio, mes, dia);
    let cls = "";
    // Fuera de periodo solo en rojo L-V (sáb/dom siguen azul)
    if (!enPeriodo && !fin) {
      if (marca === "VC") cls = "asi-mark-vc asi-mark-fuera";
      else if (marca === "V") cls = "asi-mark-v asi-mark-fuera";
      else if (marca === "C") cls = "asi-mark-c asi-mark-fuera";
      else cls = "asi-mark-fuera";
      return cls;
    }
    if (marca === "VC") cls = "asi-mark-vc";
    else if (marca === "V") cls = "asi-mark-v";
    else if (marca === "C") cls = "asi-mark-c";
    else if (tieneEvento) cls = "asi-mes-event";
    else if (fin) cls = "asi-mes-weekend";
    else if (futuro) cls = "asi-mark-future";
    else cls = "asi-mark-empty";
    if (tieneEvento) cls += " asi-mes-event-day";
    if (fin && marca) cls += " asi-mes-weekend";
    return cls;
  }

  function eventosDelDia(dia) {
    const list = state.eventosMes?.[dia];
    return Array.isArray(list) ? list : [];
  }

  function tituloEventosDia(dia) {
    const nombres = eventosDelDia(dia)
      .map((e) => e.exi_nomeve || "")
      .filter(Boolean);
    return nombres.join(" · ");
  }

  async function loadEventosMes(anio, mes) {
    try {
      const eventos = await api("/api/eventos?limit=500");
      const map = {};
      (eventos || []).forEach((eve) => {
        const s = String(eve.exi_feceve || "").slice(0, 10);
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return;
        if (Number(m[1]) !== anio || Number(m[2]) !== mes) return;
        const dia = Number(m[3]);
        if (!map[dia]) map[dia] = [];
        map[dia].push(eve);
      });
      state.eventosMes = map;
    } catch (_) {
      state.eventosMes = {};
    }
  }

  function totalesLaborablesNino(n, anio, mes, diasMes) {
    const byDia = {};
    (n.dias || []).forEach((d) => {
      byDia[d.dia] = d;
    });
    let totViene = 0;
    let totCome = 0;
    let laborables = 0;
    for (let d = 1; d <= diasMes; d += 1) {
      if (esFinDeSemana(anio, mes, d)) continue;
      if (esDiaFuturo(anio, mes, d)) continue; // futuros no cuentan como falta
      const info = byDia[d];
      // Días fuera del periodo del niño no cuentan (ya no está en el calendario)
      if (info && info.en_periodo === false) continue;
      laborables += 1;
      const marca = marcaDiaMensual(info);
      if (marca === "VC" || marca === "V" || marca === "C") totViene += 1;
      if (marca === "VC" || marca === "C") totCome += 1;
    }
    return {
      totViene,
      totCome,
      totFalta: Math.max(0, laborables - totViene),
      laborables,
    };
  }

  function mesLabelEs(anio, mes) {
    const nombres = [
      "",
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ];
    return `${nombres[mes] || mes} ${anio}`;
  }

  function syncFiltroMesFromFecha() {
    const mesInp = document.getElementById("filtro-mes-asi");
    if (!mesInp) return;
    if (mesInp.value && /^\d{4}-\d{2}$/.test(mesInp.value)) {
      state.filtroMesAsi = mesInp.value;
      return;
    }
    const base = state.filtroFechaAsi || hoyIso();
    const ym = String(base).slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(ym)) {
      state.filtroMesAsi = ym;
      mesInp.value = ym;
    }
  }

  function syncFiltroGrupoMesOptions(ninos) {
    const sel = document.getElementById("filtro-grupo-asi-mes");
    if (!sel) return;
    const grupos = [
      ...new Set((ninos || []).map((n) => String(n.asi_tipgru || "").trim()).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
    const actual = state.filtroGrupoMesAsi || "";
    sel.innerHTML =
      `<option value="">Todos</option>` +
      grupos.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
    if (actual && grupos.includes(actual)) sel.value = actual;
    else {
      sel.value = "";
      state.filtroGrupoMesAsi = "";
    }
  }

  function ninosMensualesVisibles() {
    const ninos = state.asistenciaMensual?.ninos || [];
    return ninos.filter((n) => {
      if (state.filtroGrupoMesAsi && String(n.asi_tipgru || "").trim() !== state.filtroGrupoMesAsi) {
        return false;
      }
      return matchSearch([n.asi_codnin, n.nin_nomnin, n.asi_tipgru, n.asi_codcen, n.exi_nomcen, n.nin_comali]);
    });
  }

  function buildMensualMatrix(ninos, anio, mes, diasMes) {
    const headers = [
      "Niño",
      "Grupo",
      "Centro",
      ...Array.from({ length: diasMes }, (_, i) => etiquetaDiaMes(anio, mes, i + 1)),
      "Viene",
      "Come",
      "No viene",
    ];
    const fueraPeriodoCells = [];
    const rows = ninos.map((n, rowIdx) => {
      const byDia = {};
      (n.dias || []).forEach((d) => {
        byDia[d.dia] = d;
      });
      const tots = totalesLaborablesNino(n, anio, mes, diasMes);
      for (let d = 1; d <= diasMes; d += 1) {
        if (esFinDeSemana(anio, mes, d)) continue;
        if (byDia[d] && byDia[d].en_periodo === false) {
          fueraPeriodoCells.push(`${rowIdx}:${2 + d}`);
        }
      }
      return [
        `${n.nin_nomnin || ""} (#${n.asi_codnin})`,
        n.asi_tipgru || "",
        n.exi_nomcen || n.asi_codcen || "",
        ...Array.from({ length: diasMes }, (_, i) => marcaDiaMensual(byDia[i + 1])),
        String(tots.totViene),
        String(tots.totCome),
        String(tots.totFalta),
      ];
    });
    const weekendCols = [];
    for (let d = 1; d <= diasMes; d += 1) {
      if (esFinDeSemana(anio, mes, d)) weekendCols.push(2 + d); // 0=Niño,1=Grupo,2=Centro → día1 = idx 3
    }
    return { headers, rows, weekendCols, fueraPeriodoCells };
  }

  function exportAsistenciaMensualPdf() {
    const data = state.asistenciaMensual;
    const ym = state.filtroMesAsi || "";
    if (!data || !/^\d{4}-\d{2}$/.test(ym)) {
      toast("Selecciona un mes y carga la asistencia mensual", "err");
      return;
    }
    const ninos = ninosMensualesVisibles();
    if (!ninos.length) {
      toast("No hay datos para el reporte mensual", "err");
      return;
    }
    const diasMes = Number(data.dias_mes) || 31;
    const anio = Number(data.anio);
    const mes = Number(data.mes);
    const { headers, rows, weekendCols, fueraPeriodoCells } = buildMensualMatrix(ninos, anio, mes, diasMes);
    const tipgru = state.filtroGrupoMesAsi || "";
    const grupoTxt = tipgru ? ` · Grupo ${tipgru}` : "";
    const nLab = diasLaborablesMes(anio, mes, diasMes).length;
    if (typeof downloadAsistenciaMensualPdf !== "function") {
      toast("No se pudo cargar el exportador PDF", "err");
      return;
    }
    downloadAsistenciaMensualPdf({
      filename: `exi_reporte_mensual_asistencia_comedor_${ym}${tipgru ? `_${tipgru}` : ""}`,
      title: "Reporte mensual de asistencia y comedor",
      subtitle: `${mesLabelEs(anio, mes)}${grupoTxt} · ${ninos.length} niños · ${nLab} días laborables`,
      legend:
        "Leyenda: V/VC = asistencia · gris = no viene · azul = S/D · blanco = futuro · amarillo = evento · rojo = fuera de periodo (L-V)",
      headers,
      rows,
      dayCols: diasMes,
      weekendCols,
      fueraPeriodoCells,
      futureCols: Array.from({ length: diasMes }, (_, i) => i + 1)
        .filter((d) => esDiaFuturo(anio, mes, d))
        .map((d) => 2 + d),
      eventCols: Object.keys(state.eventosMes || {})
        .map((d) => Number(d))
        .filter((d) => d >= 1 && d <= diasMes)
        .map((d) => 2 + d),
      eventTitles: Object.fromEntries(
        Object.keys(state.eventosMes || {}).map((d) => [String(2 + Number(d)), tituloEventosDia(Number(d))])
      ),
    });
    toast("Reporte mensual descargado");
  }

  function renderAsistenciaMensual() {
    const table = document.getElementById("tabla-asistencia-mensual");
    const thead = table?.querySelector("thead");
    const tbody = table?.querySelector("tbody");
    const countNinos = document.getElementById("count-asi-mes-ninos");
    const countVienen = document.getElementById("count-asi-mes-vienen");
    const countComen = document.getElementById("count-asi-mes-comen");
    const info = document.getElementById("asi-mes-info");
    if (!thead || !tbody) return;

    const data = state.asistenciaMensual;
    if (!state.filtroMesAsi || !data) {
      if (countNinos) countNinos.textContent = "0";
      if (countVienen) countVienen.textContent = "0 días vienen";
      if (countComen) countComen.innerHTML = `${icoBurger()}0 días comen`;
      const countFaltan0 = document.getElementById("count-asi-mes-faltan");
      if (countFaltan0) countFaltan0.textContent = "0 días faltan";
      if (info) {
        info.hidden = true;
        info.textContent = "";
      }
      thead.innerHTML = "";
      tbody.innerHTML = `<tr><td class="empty-state">Selecciona un mes</td></tr>`;
      return;
    }

    const anio = Number(data.anio);
    const mes = Number(data.mes);
    if (info) {
      info.hidden = false;
      info.textContent = mesLabelEs(anio, mes);
    }

    const diasMes = Number(data.dias_mes) || 31;
    const ninos = ninosMensualesVisibles();
    const totsRows = ninos.map((n) => totalesLaborablesNino(n, anio, mes, diasMes));
    const totViene = totsRows.reduce((s, t) => s + t.totViene, 0);
    const totCome = totsRows.reduce((s, t) => s + t.totCome, 0);
    const totFalta = totsRows.reduce((s, t) => s + t.totFalta, 0);
    if (countNinos) countNinos.textContent = String(ninos.length);
    if (countVienen) countVienen.textContent = `${totViene} días vienen`;
    if (countComen) countComen.innerHTML = `${icoBurger()}${totCome} días comen`;
    const countFaltan = document.getElementById("count-asi-mes-faltan");
    if (countFaltan) countFaltan.textContent = `${totFalta} días faltan`;

    thead.innerHTML = `<tr>
      <th class="asi-mes-sticky">Niño</th>
      <th class="asi-mes-sticky asi-mes-sticky-2">Grupo</th>
      <th class="asi-mes-sticky asi-mes-sticky-3">Centro</th>
      ${Array.from({ length: diasMes }, (_, i) => {
        const dia = i + 1;
        const fin = esFinDeSemana(anio, mes, dia);
        const futuro = esDiaFuturo(anio, mes, dia);
        const evTitulo = tituloEventosDia(dia);
        const tieneEv = Boolean(evTitulo);
        let extra = "";
        if (tieneEv) extra = " asi-mes-event";
        else if (fin) extra = " asi-mes-weekend";
        else if (futuro) extra = " asi-mes-future-h";
        const tipParts = [];
        if (tieneEv) tipParts.push(evTitulo);
        else if (fin) tipParts.push("Fin de semana (no cuenta)");
        else if (futuro) tipParts.push("Día futuro");
        else tipParts.push("Laborable");
        return `<th class="asi-mes-day${extra}" title="${esc(tipParts.join(" · "))}">${esc(
          etiquetaDiaMes(anio, mes, dia)
        )}</th>`;
      }).join("")}
      <th class="asi-mes-tot asi-mes-tot-v" title="Total días viene (L-V)">Viene</th>
      <th class="asi-mes-tot asi-mes-tot-c" title="Total días come (L-V)">Come</th>
      <th class="asi-mes-tot asi-mes-tot-f" title="Total días no viene (L-V)">No viene</th>
    </tr>`;

    if (!ninos.length) {
      tbody.innerHTML = `<tr><td colspan="${diasMes + 6}" class="empty-state">No hay niños para este mes</td></tr>`;
      return;
    }

    tbody.innerHTML = ninos
      .map((n, idx) => {
        const byDia = {};
        (n.dias || []).forEach((d) => {
          byDia[d.dia] = d;
        });
        const tots = totsRows[idx];
        const tieneFuera = (n.dias || []).some(
          (d) => d.en_periodo === false && !esFinDeSemana(anio, mes, d.dia)
        );
        const diasHtml = Array.from({ length: diasMes }, (_, i) => {
          const dia = i + 1;
          const info = byDia[dia];
          const marca = marcaDiaMensual(info);
          const enPeriodo = !info || info.en_periodo !== false;
          const evTitulo = tituloEventosDia(dia);
          const cls = claseCeldaMensual(anio, mes, dia, marca, Boolean(evTitulo), enPeriodo);
          const tips = [];
          if (!enPeriodo && !esFinDeSemana(anio, mes, dia)) {
            tips.push("Fuera de periodo (no inscrito en el calendario)");
          }
          if (evTitulo) tips.push(evTitulo);
          const tip = tips.length ? ` title="${esc(tips.join(" · "))}"` : "";
          return `<td class="asi-mes-day ${cls}"${tip}>${esc(marca)}</td>`;
        }).join("");
        return `<tr${tieneFuera ? ' class="asi-mes-row-fuera"' : ""}>
          <td class="asi-mes-sticky${tieneFuera ? " asi-nino-fuera" : ""}">
            <strong>${esc(n.nin_nomnin)}</strong>
            <span class="asi-nino-meta">#${esc(n.asi_codnin)}${n.nin_apoyo ? " · APOYO" : ""}${
              n.nin_comali ? ` · ${esc(n.nin_comali)}` : ""
            }${tieneFuera ? " · fuera de periodo" : ""}</span>
          </td>
          <td class="asi-mes-sticky asi-mes-sticky-2">${esc(n.asi_tipgru || "")}</td>
          <td class="asi-mes-sticky asi-mes-sticky-3">${esc(n.exi_nomcen || n.asi_codcen || "")}</td>
          ${diasHtml}
          <td class="asi-mes-tot asi-mes-tot-v">${esc(tots.totViene)}</td>
          <td class="asi-mes-tot asi-mes-tot-c">${esc(tots.totCome)}</td>
          <td class="asi-mes-tot asi-mes-tot-f">${esc(tots.totFalta)}</td>
        </tr>`;
      })
      .join("");
  }

  async function loadPeriodos() {
    state.periodos = await api("/api/periodos");
  }

  async function loadNinosPeriodo() {
    state.ninosPeriodo = await api("/api/ninos-periodo");
  }

  /** ISO date string → Date local (solo día) */
  function parseDateOnly(value) {
    const s = String(value || "").slice(0, 10);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  /**
   * Completa en_periodo por niño/día según Periodos de niños.
   * Respaldo si la API no envía el campo (servidor sin reiniciar).
   */
  function enrichMensualEnPeriodo(data) {
    if (!data?.ninos?.length) return data;
    const anio = Number(data.anio);
    const mes = Number(data.mes);
    const diasMes = Number(data.dias_mes) || 31;
    const perByCod = {};
    (state.periodos || []).forEach((p) => {
      perByCod[p.per_codper] = p;
    });
    const rangosByNino = {};
    (state.ninosPeriodo || []).forEach((r) => {
      const per = perByCod[r.nip_codper];
      if (!per) return;
      const ini = parseDateOnly(per.per_fecini);
      const fin = parseDateOnly(per.per_fecfin);
      if (!ini || !fin) return;
      if (!rangosByNino[r.nip_codnin]) rangosByNino[r.nip_codnin] = [];
      rangosByNino[r.nip_codnin].push([ini, fin]);
    });
    data.ninos.forEach((n) => {
      const rangos = rangosByNino[n.asi_codnin] || [];
      const byDia = {};
      (n.dias || []).forEach((d) => {
        byDia[d.dia] = d;
      });
      const dias = [];
      for (let d = 1; d <= diasMes; d += 1) {
        const f = new Date(anio, mes - 1, d);
        const enPeriodo = rangos.some(([ini, fin]) => f >= ini && f <= fin);
        const prev = byDia[d] || { dia: d, asist: false, comedor: false };
        dias.push({
          ...prev,
          dia: d,
          en_periodo: enPeriodo,
        });
      }
      n.dias = dias;
    });
    return data;
  }

  async function loadAsistenciaMensual() {
    const ym = state.filtroMesAsi || "";
    if (!/^\d{4}-\d{2}$/.test(ym)) {
      state.asistenciaMensual = null;
      state.eventosMes = {};
      renderAsistenciaMensual();
      return;
    }
    const [anioStr, mesStr] = ym.split("-");
    const anio = Number(anioStr);
    const mes = Number(mesStr);
    const q = new URLSearchParams({ anio: anioStr, mes: String(mes) });
    const [data] = await Promise.all([
      api(`/api/ninos-asistencia/mensual?${q.toString()}`),
      loadEventosMes(anio, mes),
      state.periodos.length ? Promise.resolve() : loadPeriodos(),
      loadNinosPeriodo(),
    ]);
    state.asistenciaMensual = enrichMensualEnPeriodo(data);
    syncFiltroGrupoMesOptions(data?.ninos || []);
    renderAsistenciaMensual();
  }

  async function ensureAsistenciaMensual(force = false) {
    if (!state.periodos.length || force) await loadPeriodos();
    syncFiltroMesFromFecha();
    await loadAsistenciaMensual();
  }

  function renderActive() {
    if (state.section === "ninos-asistencia") renderNinosAsistencia();
    if (state.section === "asistencia-mensual") renderAsistenciaMensual();
  }

  function bindFechaAsistencia() {
    const inp = document.getElementById("filtro-fecha-asi");
    if (!inp) return;
    if (!state.filtroFechaAsi) state.filtroFechaAsi = hoyIso();
    inp.value = state.filtroFechaAsi;
    if (window.ExiDates?.bind) window.ExiDates.bind(document.getElementById("sec-ninos-asistencia") || document);
    syncWeekdayLabel();
  }

  async function ensureNinosAsistencia(force = false) {
    if (!state.periodos.length || force) await loadPeriodos();
    bindFechaAsistencia();
    await loadNinosAsistenciaLista();
  }

  async function loadNinosAsistenciaLista() {
    const fecha = state.filtroFechaAsi;
    const info = document.getElementById("asi-periodo-info");
    if (!fecha) {
      state.asistenciaLista = [];
      if (info) {
        info.hidden = true;
        info.textContent = "";
      }
      syncFiltroGrupoOptions();
      renderNinosAsistencia();
      return;
    }
    const periodo = (state.periodos || []).find((p) => {
      const f = String(fecha).slice(0, 10);
      return String(p.per_fecini).slice(0, 10) <= f && String(p.per_fecfin).slice(0, 10) >= f;
    });
    if (info) {
      if (periodo) {
        info.hidden = false;
        info.textContent = `Periodo ${periodo.per_codper} · ${fmtDateOnly(periodo.per_fecini)} - ${fmtDateOnly(
          periodo.per_fecfin
        )}`;
      } else {
        info.hidden = false;
        info.textContent = "Sin periodo para esta fecha";
      }
    }
    state.asistenciaLista = await api(
      `/api/ninos-asistencia/lista?fecha=${encodeURIComponent(fecha)}`
    );
    syncFiltroGrupoOptions();
    renderNinosAsistencia();
  }

  function icoBurger() {
    return `<span class="asi-ico" aria-hidden="true"><img src="/static/icons/burger.png" alt="" width="18" height="18" /></span>`;
  }

  function icoCheck() {
    return `<span class="asi-ico asi-ico-check" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M9.2 16.6 4.8 12.2l1.4-1.4 3 3 8-8 1.4 1.4-9.4 9.4z"/></svg></span>`;
  }

  async function guardarAsistencia(btn, { asist, comedor }) {
    const codnin = Number(btn.dataset.codnin);
    const fecha = state.filtroFechaAsi;
    const row = btn.closest("tr");
    const toggles = row ? row.querySelectorAll(".asi-toggle") : [btn];
    toggles.forEach((b) => {
      b.disabled = true;
    });
    try {
      if (!asist && !comedor) {
        await api(`/api/ninos-asistencia/dia/${encodeURIComponent(fecha)}/nino/${codnin}`, {
          method: "DELETE",
        });
        toast("Sin marcar");
      } else {
        await api("/api/ninos-asistencia", {
          method: "POST",
          body: JSON.stringify({
            asi_fecasi: fecha,
            asi_codnin: codnin,
            asi_codmon: null,
            asi_codcen: btn.dataset.codcen,
            asi_codper: btn.dataset.codper,
            asi_tipgru: btn.dataset.tipgru,
            asi_asist: true,
            asi_comedor: !!comedor,
          }),
        });
        toast(comedor ? "Viene y come" : "Ha venido");
      }
      await loadNinosAsistenciaLista();
    } catch (err) {
      toast(err.message, "err");
      await loadNinosAsistenciaLista();
    }
  }

  function renderNinosAsistencia() {
    const tbody = document.querySelector("#tabla-ninos-asistencia tbody");
    const countEl = document.getElementById("count-ninos-asistencia");
    const countVienen = document.getElementById("count-asi-vienen");
    const countComen = document.getElementById("count-asi-comen");
    const countFaltan = document.getElementById("count-asi-faltan");
    const diaLabel = document.getElementById("asi-dia-label");
    if (!tbody) return;

    if (diaLabel) {
      const fechaTxt = state.filtroFechaAsi ? fmtDateOnly(state.filtroFechaAsi) : "—";
      const weekTxt = state.filtroFechaAsi ? weekdayNameEs(state.filtroFechaAsi) : "";
      diaLabel.textContent = weekTxt ? `${weekTxt} · ${fechaTxt}` : fechaTxt;
    }
    syncWeekdayLabel();

    if (!state.filtroFechaAsi) {
      if (countEl) countEl.textContent = "0";
      if (countVienen) countVienen.textContent = "0 vienen";
      if (countComen) countComen.innerHTML = `${icoBurger()}0 comen`;
      if (countFaltan) countFaltan.textContent = "0 faltan";
      tbody.innerHTML = `<tr><td colspan="${colspanDiaria()}" class="empty-state">Selecciona un día</td></tr>`;
      return;
    }

    const rows = filasAsistenciaVisibles();
    const vienen = rows.filter((r) => r.estado === "asiste" || r.estado === "comedor" || r.asi_asist).length;
    const comen = rows.filter((r) => r.estado === "comedor" || r.asi_comedor).length;
    const faltan = rows.length - vienen;
    if (countEl) countEl.textContent = String(rows.length);
    if (countVienen) countVienen.textContent = `${vienen} vienen`;
    if (countComen) countComen.innerHTML = `${icoBurger()}${comen} comen`;
    if (countFaltan) countFaltan.textContent = `${faltan} faltan`;

    if (!rows.length) {
      const msg = state.filtroGrupoAsi
        ? `No hay niños del grupo ${state.filtroGrupoAsi} en esta fecha`
        : "No hay niños con grupo en el periodo de esta fecha";
      tbody.innerHTML = `<tr><td colspan="${colspanDiaria()}" class="empty-state">${esc(msg)}</td></tr>`;
      return;
    }

    tbody.innerHTML = rows
      .map((r) => {
        const estado = r.estado || (r.asi_comedor ? "comedor" : r.asi_asist ? "asiste" : "no");
        const viene = estado === "asiste" || estado === "comedor";
        const come = estado === "comedor";
        const quien = r.usr_name || r.asi_usrcre || "";
        const cuando = r.asi_feccre ? fmtDateTime(r.asi_feccre) : "";
        const comali = (r.nin_comali || "").trim();
        return `<tr${come && comali ? ' class="asi-row-come-ali"' : ""}>
          <td>
            <strong>${esc(r.nin_nomnin)}</strong>
            <span class="asi-nino-meta">#${esc(r.asi_codnin)}${r.nin_apoyo ? " · APOYO" : ""}</span>
          </td>
          <td>${esc(r.asi_tipgru || "")}</td>
          <td>${esc(r.exi_nomcen || r.asi_codcen || "")}</td>
          <td class="asi-col-check">
            <button type="button" class="asi-toggle asi-toggle-viene${viene ? " on" : ""}"
              data-act="viene"
              data-codnin="${r.asi_codnin}"
              data-codcen="${esc(r.asi_codcen)}"
              data-codper="${esc(r.asi_codper)}"
              data-tipgru="${esc(r.asi_tipgru)}"
              data-viene="${viene ? "1" : "0"}"
              data-come="${come ? "1" : "0"}"
              title="Ha venido"
              aria-pressed="${viene ? "true" : "false"}"
              aria-label="Ha venido">${icoCheck()}</button>
          </td>
          <td class="asi-col-check">
            <button type="button" class="asi-toggle asi-toggle-come${come ? " on" : ""}"
              data-act="come"
              data-codnin="${r.asi_codnin}"
              data-codcen="${esc(r.asi_codcen)}"
              data-codper="${esc(r.asi_codper)}"
              data-tipgru="${esc(r.asi_tipgru)}"
              data-viene="${viene ? "1" : "0"}"
              data-come="${come ? "1" : "0"}"
              title="Come"
              aria-pressed="${come ? "true" : "false"}"
              aria-label="Come">${icoBurger()}</button>
          </td>
          <td class="asi-comali-cell">${
            comali
              ? `<span class="asi-comali${come ? " on" : ""}" title="${esc(comali)}">${esc(comali)}</span>`
              : "—"
          }</td>
          <td class="asi-reg-meta asi-col-meta">${quien ? `<span class="asi-reg-user">${esc(quien)}</span>` : "—"}</td>
          <td class="asi-reg-meta asi-col-meta">${cuando ? `<span class="asi-reg-date">${esc(cuando)}</span>` : "—"}</td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll(".asi-toggle").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const act = btn.dataset.act;
        let viene = btn.dataset.viene === "1";
        let come = btn.dataset.come === "1";
        if (act === "viene") {
          viene = !viene;
          if (!viene) come = false;
        } else {
          come = !come;
          if (come) viene = true;
        }
        await guardarAsistencia(btn, { asist: viene, comedor: come });
      });
    });
  }

  const fechaAsiInp = document.getElementById("filtro-fecha-asi");
  if (fechaAsiInp) {
    fechaAsiInp.addEventListener("change", async () => {
      state.filtroFechaAsi = window.ExiDates?.toIsoDate
        ? window.ExiDates.toIsoDate(fechaAsiInp.value) || fechaAsiInp.value
        : fechaAsiInp.value;
      syncWeekdayLabel();
      try {
        await loadNinosAsistenciaLista();
      } catch (err) {
        toast(err.message, "err");
      }
    });
  }

  document.getElementById("filtro-grupo-asi")?.addEventListener("change", (ev) => {
    state.filtroGrupoAsi = ev.target.value || "";
    renderNinosAsistencia();
  });

  document.getElementById("btn-toggle-meta-asi")?.addEventListener("click", () => {
    state.mostrarMetaAsi = !state.mostrarMetaAsi;
    try {
      localStorage.setItem("exi_asi_mostrar_meta", state.mostrarMetaAsi ? "1" : "0");
    } catch (_) {
      /* ignore */
    }
    syncMetaAsiVisibility();
  });

  try {
    state.mostrarMetaAsi = localStorage.getItem("exi_asi_mostrar_meta") === "1";
  } catch (_) {
    state.mostrarMetaAsi = false;
  }
  syncMetaAsiVisibility();

  document.getElementById("filtro-mes-asi")?.addEventListener("change", async (ev) => {
    state.filtroMesAsi = ev.target.value || "";
    try {
      await loadAsistenciaMensual();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  document.getElementById("filtro-grupo-asi-mes")?.addEventListener("change", (ev) => {
    state.filtroGrupoMesAsi = ev.target.value || "";
    renderAsistenciaMensual();
  });

  document.getElementById("btn-pdf-asi-mes")?.addEventListener("click", () => {
    exportAsistenciaMensualPdf();
  });

  document.getElementById("btn-descargar-asi")?.addEventListener("click", () => {
    if (!state.filtroFechaAsi) {
      toast("Selecciona un día antes de descargar", "err");
      return;
    }
    const rows = filasAsistenciaVisibles().map((r) => {
      const estado = r.estado || (r.asi_comedor ? "comedor" : r.asi_asist ? "asiste" : "no");
      const viene = estado === "asiste" || estado === "comedor";
      const come = estado === "comedor";
      return {
        fecha: r.asi_fecasi,
        periodo: r.asi_codper,
        nino: r.nin_nomnin,
        grupo: r.asi_tipgru,
        centro: r.exi_nomcen || r.asi_codcen,
        viene: viene ? "Sí" : "",
        come: come ? "Sí" : "",
        alimentacion: r.nin_comali || "",
        registrado_por: r.usr_name || r.asi_usrcre || "",
        fecha_registro: r.asi_feccre ? fmtDateTime(r.asi_feccre) : "",
      };
    });
    if (!rows.length) {
      toast("No hay datos para descargar", "err");
      return;
    }
    const header = [
      "fecha",
      "periodo",
      "nino",
      "grupo",
      "centro",
      "viene",
      "come",
      "alimentacion",
      "registrado_por",
      "fecha_registro",
    ];
    const csv = [
      header.join(";"),
      ...rows.map((r) => header.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(";")),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `exi_ninos_asistencia_${state.filtroFechaAsi}${
      state.filtroGrupoAsi ? `_${state.filtroGrupoAsi}` : ""
    }.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  switchSection(state.section);
})();
