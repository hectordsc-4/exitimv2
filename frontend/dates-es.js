/**
 * Fechas EXI: visualización dd/mm/yyyy y calendario con semana empezando en lunes.
 * Requiere flatpickr + locale es cargados antes.
 */
(function (global) {
  const ES_LOCALE = {
    ...(global.flatpickr?.l10ns?.es || {}),
    firstDayOfWeek: 1,
    weekdays: {
      shorthand: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
      longhand: [
        "Domingo",
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
      ],
    },
    months: {
      shorthand: [
        "Ene",
        "Feb",
        "Mar",
        "Abr",
        "May",
        "Jun",
        "Jul",
        "Ago",
        "Sep",
        "Oct",
        "Nov",
        "Dic",
      ],
      longhand: [
        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre",
      ],
    },
  };

  function toIsoDate(value) {
    if (!value) return "";
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, "0");
      const d = String(value.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const dd = m[1].padStart(2, "0");
      const mm = m[2].padStart(2, "0");
      return `${m[3]}-${mm}-${dd}`;
    }
    return "";
  }

  function toEsDate(value) {
    const iso = toIsoDate(value);
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  function bindExiDates(root = document) {
    if (!global.flatpickr) return;
    const nodes = root.querySelectorAll
      ? root.querySelectorAll("input.exi-date")
      : [];
    nodes.forEach((el) => {
      if (el.disabled) return;
      if (el._flatpickr) {
        el._flatpickr.setDate(el.value || null, true);
        return;
      }
      const iso = toIsoDate(el.value);
      if (iso) el.value = iso;
      global.flatpickr(el, {
        locale: ES_LOCALE,
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d/m/Y",
        allowInput: true,
        disableMobile: true,
        weekNumbers: false,
        defaultDate: iso || undefined,
        onReady(_selected, _dateStr, instance) {
          if (instance.altInput) {
            instance.altInput.placeholder = "dd/mm/aaaa";
            instance.altInput.setAttribute("autocomplete", "off");
            if (el.required) instance.altInput.required = true;
          }
        },
      });
    });
  }

  function destroyExiDates(root = document) {
    const nodes = root.querySelectorAll
      ? root.querySelectorAll("input.exi-date")
      : [];
    nodes.forEach((el) => {
      if (el._flatpickr) el._flatpickr.destroy();
    });
  }

  global.ExiDates = {
    toIsoDate,
    toEsDate,
    bind: bindExiDates,
    destroy: destroyExiDates,
  };
})(window);
