/**
 * Client-side export utilities
 * Generates Excel-compatible CSV and triggers browser download.
 * No server round-trip needed for simple exports.
 */

export function downloadCSV(filename: string, rows: Record<string, unknown>[], headers?: Record<string, string>) {
  if (!rows.length) return;

  const keys = Object.keys(rows[0]);
  const headerRow = keys.map((k) => headers?.[k] ?? k).join(",");

  const dataRows = rows.map((row) =>
    keys.map((k) => {
      const val = row[k];
      if (val === null || val === undefined) return "";
      const str = String(val);
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(",")
  );

  // BOM for Excel UTF-8 compatibility
  const bom = "\uFEFF";
  const content = bom + [headerRow, ...dataRows].join("\r\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Voucher export helpers
export function exportVouchers(vouchers: Record<string, unknown>[], filename: string) {
  const rows = vouchers.map((v) => ({
    Serie: v.serie,
    Número: v.numero,
    Tipo: v.tipo,
    "Fecha Emisión": v.fechaEmision ? String(v.fechaEmision).split("T")[0] : "",
    "Fecha Vencimiento": v.fechaVencimiento ? String(v.fechaVencimiento).split("T")[0] : "",
    "RUC Emisor": v.rucEmisor,
    Emisor: v.razonSocialEmisor,
    "RUC Receptor": v.rucReceptor,
    Receptor: v.razonSocialReceptor,
    Moneda: v.moneda,
    Subtotal: v.subtotal,
    IGV: v.igv,
    Total: v.total,
    Estado: v.estado,
    XML: v.tieneXML ? "Sí" : "No",
    PDF: v.tienePDF ? "Sí" : "No",
    CDR: v.tieneCDR ? "Sí" : "No",
    "Afecto Detracción": v.afectoDetraccion ? "Sí" : "No",
    "% Detracción": v.porcentajeDetraccion ?? "",
    "Monto Detracción": v.montoDetraccion ?? "",
    "Estado Detracción": v.estadoDetraccion ?? "",
  }));
  downloadCSV(filename, rows);
}

export function exportDetracciones(detracciones: Record<string, unknown>[], filename: string) {
  const rows = detracciones.map((d) => ({
    Serie: d.serie,
    Número: d.numero,
    "Fecha Emisión": d.fechaEmision ? String(d.fechaEmision).split("T")[0] : "",
    Proveedor: d.razonSocialEmisor,
    "RUC Proveedor": d.rucEmisor,
    "Total Comprobante": d.total,
    "% Detracción": d.porcentaje,
    "Monto Detracción": d.monto,
    "Neto a Pagar": Number(d.total) - Number(d.monto),
    Estado: d.estado,
    "Fecha Pago": d.fechaPago ?? "",
    "N° Constancia": d.numeroConstancia ?? "",
  }));
  downloadCSV(filename, rows);
}

export function exportCuentas(cuentas: Record<string, unknown>[], tipo: "cobrar" | "pagar", filename: string) {
  const rows = cuentas.map((c) => ({
    [tipo === "cobrar" ? "Cliente" : "Proveedor"]: tipo === "cobrar" ? c.cliente : c.proveedor,
    RUC: c.ruc,
    Documento: c.documento,
    Moneda: c.moneda,
    Monto: c.monto,
    "Monto Pagado": c.montoPagado ?? 0,
    Saldo: c.saldo,
    "Fecha Emisión": c.fechaEmision ? String(c.fechaEmision).split("T")[0] : "",
    "Fecha Vencimiento": c.fechaVencimiento ? String(c.fechaVencimiento).split("T")[0] : "",
    "Días Vencimiento": c.diasVencimiento,
    Estado: c.estado,
  }));
  downloadCSV(filename, rows);
}
