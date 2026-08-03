/**
 * Exporta el grid visible de una tabla HTML a CSV (compatible Excel).
 */
function downloadTableCsv(tableSelector, filename) {
  const table = document.querySelector(tableSelector);
  if (!table) return;

  const headers = [...table.querySelectorAll("thead th")]
    .map((th) => th.textContent.trim())
    .filter((h) => h.toLowerCase() !== "acciones");

  const rows = [];
  table.querySelectorAll("tbody tr").forEach((tr) => {
    const cells = [...tr.querySelectorAll("td")];
    if (!cells.length) return;
    // última columna suele ser Acciones: la omitimos si el thead tenía Acciones
    const take = headers.length;
    const values = cells.slice(0, take).map((td) => td.innerText.trim().replace(/\s+/g, " "));
    if (values.every((v) => !v) || values[0]?.includes("No hay")) return;
    rows.push(values);
  });

  if (!rows.length) {
    alert("No hay datos para descargar en el grid.");
    return;
  }

  const escapeCell = (v) => {
    const s = String(v ?? "");
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [headers.map(escapeCell).join(";"), ...rows.map((r) => r.map(escapeCell).join(";"))];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `${filename}_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

/**
 * CSV de matriz periodos.
 * @param {{ filename: string, headers: string[], rows: string[][] }} opts
 */
function downloadMatrixCsv(opts) {
  const { filename, headers, rows } = opts || {};
  if (!headers?.length || !rows?.length) {
    alert("No hay datos para descargar.");
    return;
  }
  const escapeCell = (v) => {
    const s = String(v ?? "");
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(escapeCell).join(";"), ...rows.map((r) => r.map(escapeCell).join(";"))];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${exportStamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Informe PDF de matriz periodos (jsPDF + autoTable).
 * @param {{
 *   filename: string,
 *   title: string,
 *   subtitle?: string,
 *   headers: string[],
 *   rows: string[][],
 * }} opts
 */
function downloadMatrixPdf(opts) {
  const { filename, title, subtitle, headers, rows } = opts || {};
  if (!headers?.length || !rows?.length) {
    alert("No hay datos para el informe PDF.");
    return;
  }

  const jspdfNs = window.jspdf;
  if (!jspdfNs?.jsPDF) {
    alert("No se pudo cargar la librería PDF. Recarga la página e inténtalo de nuevo.");
    return;
  }

  const doc = new jspdfNs.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  if (typeof doc.autoTable !== "function") {
    alert("No se pudo cargar el plugin de tablas PDF. Recarga la página e inténtalo de nuevo.");
    return;
  }

  const generated = new Date().toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(194, 24, 91);
  doc.text(title || "Informe EXI", 14, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 74, 82);
  let y = 22;
  if (subtitle) {
    doc.text(subtitle, 14, y);
    y += 5;
  }
  doc.text(`Generado: ${generated}`, 14, y);

  doc.autoTable({
    startY: y + 4,
    head: [headers],
    body: rows,
    styles: {
      fontSize: 7.5,
      cellPadding: 1.6,
      valign: "middle",
      textColor: [30, 26, 32],
      lineColor: [234, 223, 227],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [252, 228, 243],
      textColor: [194, 24, 91],
      fontStyle: "bold",
      halign: "center",
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 42, halign: "left", fontStyle: "bold" },
      1: { cellWidth: 18, halign: "center" },
    },
    alternateRowStyles: { fillColor: [255, 250, 252] },
    didParseCell(data) {
      if (data.section === "body" && data.column.index >= 2) {
        data.cell.styles.halign = "center";
        if (String(data.cell.raw || "").toUpperCase() === "SÍ" || String(data.cell.raw || "") === "Sí") {
          data.cell.styles.textColor = [194, 24, 91];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: 10, right: 10 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 122, 128);
    doc.text(`EXI · ${title || "Informe"} · pág. ${i}/${pageCount}`, 14, 200);
  }

  doc.save(`${filename}_${exportStamp()}.pdf`);
}

/**
 * PDF mensual: niño × días (V/C) + totales.
 * @param {{
 *   filename: string,
 *   title: string,
 *   subtitle?: string,
 *   legend?: string,
 *   headers: string[],
 *   rows: string[][],
 *   dayCols?: number,
 * }} opts
 */
function downloadAsistenciaMensualPdf(opts) {
  const {
    filename,
    title,
    subtitle,
    legend,
    headers,
    rows,
    dayCols,
    weekendCols,
    futureCols,
    eventCols,
    fueraPeriodoCells,
  } = opts || {};
  if (!headers?.length || !rows?.length) {
    alert("No hay datos para el informe PDF.");
    return;
  }

  const jspdfNs = window.jspdf;
  if (!jspdfNs?.jsPDF) {
    alert("No se pudo cargar la librería PDF. Recarga la página e inténtalo de nuevo.");
    return;
  }

  const doc = new jspdfNs.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  if (typeof doc.autoTable !== "function") {
    alert("No se pudo cargar el plugin de tablas PDF. Recarga la página e inténtalo de nuevo.");
    return;
  }

  const generated = new Date().toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(194, 24, 91);
  doc.text(title || "Reporte mensual de asistencia y comedor", 8, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 74, 82);
  let y = 17;
  if (subtitle) {
    doc.text(subtitle, 8, y);
    y += 4;
  }
  if (legend) {
    doc.text(legend, 8, y);
    y += 4;
  }
  doc.text(`Generado: ${generated}`, 8, y);

  const nDays = Number(dayCols) || Math.max(0, headers.length - 6);
  const weekendSet = new Set(Array.isArray(weekendCols) ? weekendCols : []);
  const futureSet = new Set(Array.isArray(futureCols) ? futureCols : []);
  const eventSet = new Set(Array.isArray(eventCols) ? eventCols : []);
  const fueraSet = new Set(Array.isArray(fueraPeriodoCells) ? fueraPeriodoCells : []);
  const columnStyles = {
    0: { cellWidth: 28, halign: "left", fontStyle: "bold", fontSize: 5.5 },
    1: { cellWidth: 13, halign: "center", fontStyle: "bold", fontSize: 5 },
    2: { cellWidth: 13, halign: "center", fontStyle: "bold", fontSize: 5 },
  };
  for (let i = 0; i < nDays; i += 1) {
    const colIdx = 3 + i;
    columnStyles[colIdx] = {
      cellWidth: 5.4,
      halign: "center",
      fontStyle: "bold",
      fontSize: 4.8,
      cellPadding: 0.3,
    };
  }
  const totVIdx = 3 + nDays;
  const totCIdx = totVIdx + 1;
  const totFIdx = totCIdx + 1;
  columnStyles[totVIdx] = {
    cellWidth: 9,
    halign: "center",
    fontStyle: "bold",
    fontSize: 6.5,
    fillColor: [232, 250, 248],
  };
  columnStyles[totCIdx] = {
    cellWidth: 9,
    halign: "center",
    fontStyle: "bold",
    fontSize: 6.5,
    fillColor: [252, 228, 243],
  };
  columnStyles[totFIdx] = {
    cellWidth: 10,
    halign: "center",
    fontStyle: "bold",
    fontSize: 6.5,
    fillColor: [243, 244, 246],
  };

  doc.autoTable({
    startY: y + 3,
    head: [headers],
    body: rows,
    styles: {
      fontSize: 5.2,
      cellPadding: 0.45,
      valign: "middle",
      fontStyle: "bold",
      textColor: [30, 26, 32],
      lineColor: [234, 223, 227],
      lineWidth: 0.15,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [252, 228, 243],
      textColor: [194, 24, 91],
      fontStyle: "bold",
      halign: "center",
      fontSize: 4.6,
      cellPadding: 0.35,
    },
    columnStyles,
    alternateRowStyles: { fillColor: [255, 250, 252] },
    didParseCell(data) {
      const idx = data.column.index;
      const raw = String(data.cell.raw || "");
      const isWeekend = weekendSet.has(idx);
      const isFuture = futureSet.has(idx);
      const isEvent = eventSet.has(idx);
      const isFuera =
        data.section === "body" && fueraSet.has(`${data.row.index}:${idx}`);
      data.cell.styles.fontStyle = "bold";
      if (data.section === "head" && idx >= 3 && idx < totVIdx) {
        if (isEvent) {
          data.cell.styles.fillColor = [253, 224, 71];
          data.cell.styles.textColor = [133, 77, 14];
        } else if (isWeekend) {
          data.cell.styles.fillColor = [191, 219, 254];
          data.cell.styles.textColor = [30, 64, 175];
        } else if (isFuture) {
          data.cell.styles.fillColor = [255, 255, 255];
          data.cell.styles.textColor = [156, 163, 175];
        }
      }
      if (data.section !== "body") return;
      if (idx >= 3 && idx < totVIdx) {
        data.cell.styles.halign = "center";
        if (isFuera) {
          data.cell.styles.fillColor = [254, 202, 202];
          data.cell.styles.textColor = [153, 27, 27];
        } else if (raw === "VC") {
          data.cell.styles.textColor = [194, 24, 91];
          data.cell.styles.fillColor = [252, 228, 243];
        } else if (raw === "V") {
          data.cell.styles.textColor = [15, 118, 110];
          data.cell.styles.fillColor = [232, 250, 248];
        } else if (raw === "C") {
          data.cell.styles.textColor = [194, 24, 91];
        } else if (isEvent) {
          data.cell.styles.fillColor = [254, 240, 138];
          data.cell.styles.textColor = [133, 77, 14];
        } else if (isWeekend) {
          data.cell.styles.fillColor = [191, 219, 254];
          data.cell.styles.textColor = [30, 64, 175];
        } else if (isFuture) {
          data.cell.styles.fillColor = [255, 255, 255];
          data.cell.styles.textColor = [209, 213, 219];
        } else {
          data.cell.styles.fillColor = [229, 231, 235];
          data.cell.styles.textColor = [75, 85, 99];
        }
      }
    },
    margin: { left: 4, right: 4 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(140, 122, 128);
    doc.text(`EXI · ${title || "Reporte mensual"} · pág. ${i}/${pageCount}`, 8, 202);
  }

  doc.save(`${filename}_${exportStamp()}.pdf`);
}
