/**
 * Client-side export utilities — generates real .xlsx files using SheetJS
 */

import * as XLSX from "xlsx";

function downloadXLSX(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-width columns
  const colWidths = Object.keys(rows[0]).map((key) => ({
    wch: Math.max(key.length, ...rows.slice(0, 200).map((r) => String(r[key] ?? "").length)) + 2,
  }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

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
    Subtotal: Number(v.subtotal ?? 0),
    IGV: Number(v.igv ?? 0),
    Total: Number(v.total ?? 0),
    Estado: v.estado,
    XML: v.tieneXML ? "Sí" : "No",
    PDF: v.tienePDF ? "Sí" : "No",
    CDR: v.tieneCDR ? "Sí" : "No",
    "Afecto Detracción": v.afectoDetraccion ? "Sí" : "No",
    "% Detracción": v.porcentajeDetraccion ?? "",
    "Monto Detracción": v.montoDetraccion ?? "",
    "Estado Detracción": v.estadoDetraccion ?? "",
  }));
  downloadXLSX(filename, rows);
}

export function exportDetracciones(detracciones: Record<string, unknown>[], filename: string) {
  const rows = detracciones.map((d) => ({
    Serie: d.serie,
    Número: d.numero,
    "Fecha Emisión": d.fechaEmision ? String(d.fechaEmision).split("T")[0] : "",
    Proveedor: d.razonSocialEmisor,
    "RUC Proveedor": d.rucEmisor,
    "Total Comprobante": Number(d.total ?? 0),
    "% Detracción": Number(d.porcentaje ?? 0),
    "Monto Detracción": Number(d.monto ?? 0),
    "Neto a Pagar": Number(d.total ?? 0) - Number(d.monto ?? 0),
    Estado: d.estado,
    "Fecha Pago": d.fechaPago ?? "",
    "N° Constancia": d.numeroConstancia ?? "",
  }));
  downloadXLSX(filename, rows);
}

export function exportCuentas(cuentas: Record<string, unknown>[], tipo: "cobrar" | "pagar", filename: string) {
  const rows = cuentas.map((c) => ({
    [tipo === "cobrar" ? "Cliente" : "Proveedor"]: tipo === "cobrar" ? c.cliente : c.proveedor,
    RUC: c.ruc,
    Documento: c.documento,
    Moneda: c.moneda,
    Monto: Number(c.monto ?? 0),
    "Monto Pagado": Number(c.montoPagado ?? 0),
    Saldo: Number(c.saldo ?? 0),
    "Fecha Emisión": c.fechaEmision ? String(c.fechaEmision).split("T")[0] : "",
    "Fecha Vencimiento": c.fechaVencimiento ? String(c.fechaVencimiento).split("T")[0] : "",
    "Días Vencimiento": c.diasVencimiento,
    Estado: c.estado,
  }));
  downloadXLSX(filename, rows);
}

// Keep CSV for backward compat
export function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  downloadXLSX(filename, rows);
}
