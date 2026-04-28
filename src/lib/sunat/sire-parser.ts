/**
 * Parser de archivos SIRE (formato PLE/TXT)
 * 
 * SUNAT devuelve ZIPs con archivos TXT en formato pipe-delimited.
 * 
 * Formato RCE (Registro de Compras) - Estructura 8.1:
 * Campo 1: Período (YYYYMM)
 * Campo 2: CUO (Código Único de Operación)
 * Campo 3: Número correlativo
 * Campo 4: Fecha emisión (DD/MM/YYYY)
 * Campo 5: Fecha vencimiento
 * Campo 6: Tipo comprobante (01=Factura, 03=Boleta, etc.)
 * Campo 7: Serie
 * Campo 8: Año DUA
 * Campo 9: Número
 * Campo 10: Tipo doc identidad proveedor (6=RUC)
 * Campo 11: RUC proveedor
 * Campo 12: Razón social proveedor
 * Campo 13: Base imponible gravada
 * Campo 14: IGV
 * Campo 15: Base imponible inafecta
 * Campo 16: Base imponible exonerada
 * Campo 17: ISC
 * Campo 18: Base imponible IVAP
 * Campo 19: IVAP
 * Campo 20: ICBPER
 * Campo 21: Otros tributos
 * Campo 22: Total comprobante
 * Campo 23: Moneda
 * Campo 24: Tipo de cambio
 * Campo 25: Fecha emisión doc referencia
 * Campo 26: Tipo doc referencia
 * Campo 27: Serie doc referencia
 * Campo 28: Número doc referencia
 * Campo 29: Código detracción
 * Campo 30: Número constancia detracción
 * Campo 31: Fecha pago detracción
 * Campo 32: Tipo comprobante retencion
 * Campo 33: Serie comprobante retencion
 * Campo 34: Número comprobante retencion
 * Campo 35: Marca comprobante sujeto retención
 * Campo 36: Clasificación bienes y servicios
 * Campo 37: Identificación contrato
 * Campo 38: Error tipo 1
 * Campo 39: Indicador comprobante cancelado
 * Campo 40: Estado
 */

import AdmZip from "adm-zip";

export interface SireComprobanteData {
  periodo?: string;
  fechaEmision?: string;
  tipoComprobante?: string;
  serie?: string;
  numero?: string;
  rucEmisor?: string;
  razonSocial?: string;
  baseImponible?: string;
  igv?: string;
  importeTotal?: string;
  moneda?: string;
  estado?: string;
  // Detracción
  codigoDetraccion?: string;
  numeroConstanciaDetraccion?: string;
  fechaPagoDetraccion?: string;
}

export async function parseSireFromZipBuffer(
  zipBuffer: Buffer,
  tipo: string
): Promise<SireComprobanteData[]> {
  const comprobantes: SireComprobanteData[] = [];

  try {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    console.log(`[SIRE Parser] ZIP entries: ${entries.map(e => e.entryName).join(", ")}`);

    for (const entry of entries) {
      const name = entry.entryName.toLowerCase();
      const content = entry.getData().toString("utf8");

      // TXT pipe-delimited (formato PLE)
      if (name.endsWith(".txt") || name.endsWith(".csv")) {
        const lines = content.split("\n").filter(l => l.trim());
        console.log(`[SIRE Parser] Procesando ${name}: ${lines.length} líneas`);

        for (const line of lines) {
          const fields = line.split("|");
          if (fields.length < 10) continue;

          // Detectar formato por número de campos y tipo
          const parsed = parseRCELine(fields, tipo);
          if (parsed) comprobantes.push(parsed);
        }
      }

      // Excel (.xlsx) — algunos períodos vienen en Excel
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const XLSX = require("xlsx");
          const wb = XLSX.read(entry.getData(), { type: "buffer" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
          console.log(`[SIRE Parser] Excel ${name}: ${rows.length} filas`);

          for (const row of rows.slice(1)) { // skip header
            const parsed = parseExcelRow(row as string[], tipo);
            if (parsed) comprobantes.push(parsed);
          }
        } catch (e) {
          console.error(`[SIRE Parser] Error leyendo Excel ${name}:`, e);
        }
      }
    }
  } catch (error) {
    console.error("[SIRE Parser] Error procesando ZIP:", error);
    throw error;
  }

  console.log(`[SIRE Parser] Total comprobantes parseados: ${comprobantes.length}`);
  return comprobantes;
}

function parseRCELine(fields: string[], tipo: string): SireComprobanteData | null {
  try {
    // Limpiar campos
    const f = fields.map(f => f.trim().replace(/\r/g, ""));

    // Validar que tenga datos mínimos
    const tipoComp = f[5] || f[4] || "";
    const serie = f[6] || f[5] || "";
    const numero = f[8] || f[7] || "";
    const ruc = f[10] || f[9] || "";
    const razonSocial = f[11] || f[10] || "";

    if (!numero || !ruc) return null;

    // Determinar índices según tipo de archivo
    // RCE (compras): campo 0=periodo, 3=fecha, 5=tipo, 6=serie, 8=numero, 10=ruc, 11=razon, 12=base, 13=igv, 21=total, 22=moneda
    // RVIE (ventas): similar pero con receptor en lugar de emisor

    const esVenta = tipo === "propuesta-ventas";

    return {
      periodo: f[0],
      fechaEmision: formatDate(f[3] || f[2]),
      tipoComprobante: tipoComp,
      serie: serie,
      numero: numero,
      rucEmisor: esVenta ? "" : ruc,
      razonSocial: razonSocial,
      baseImponible: f[12] || "0",
      igv: f[13] || "0",
      importeTotal: f[21] || f[20] || "0",
      moneda: f[22] || f[21] || "PEN",
      estado: f[f.length - 1] || "1",
      codigoDetraccion: f[28] || "",
      numeroConstanciaDetraccion: f[29] || "",
      fechaPagoDetraccion: f[30] || "",
    };
  } catch {
    return null;
  }
}

function parseExcelRow(row: string[], tipo: string): SireComprobanteData | null {
  try {
    if (!row || row.length < 5) return null;
    const f = row.map(v => String(v ?? "").trim());

    // Intentar detectar columnas por posición
    // Formato típico Excel SIRE: Período | Fecha | Tipo | Serie | Número | RUC | Razón Social | Base | IGV | Total | Moneda
    const numero = f[4] || f[3] || "";
    const ruc = f[5] || f[4] || "";

    if (!numero || !ruc || ruc.length !== 11) return null;

    return {
      periodo: f[0],
      fechaEmision: formatDate(f[1]),
      tipoComprobante: f[2],
      serie: f[3],
      numero: numero,
      rucEmisor: ruc,
      razonSocial: f[6] || "",
      baseImponible: f[7] || "0",
      igv: f[8] || "0",
      importeTotal: f[9] || "0",
      moneda: f[10] || "PEN",
    };
  } catch {
    return null;
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString().split("T")[0];
  // DD/MM/YYYY → YYYY-MM-DD
  if (dateStr.includes("/")) {
    const [d, m, y] = dateStr.split("/");
    return `${y}-${m?.padStart(2,"0")}-${d?.padStart(2,"0")}`;
  }
  // YYYYMMDD → YYYY-MM-DD
  if (dateStr.length === 8 && !dateStr.includes("-")) {
    return `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
  }
  return dateStr;
}
