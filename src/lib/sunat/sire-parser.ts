/**
 * Parser de archivos SIRE (formato PLE/TXT)
 *
 * SUNAT devuelve ZIPs con archivos TXT en formato pipe-delimited.
 *
 * Formato RCE (Registro de Compras) - Estructura 8.1 PLE:
 * [0]  Período tributario          YYYYMM
 * [1]  CUO
 * [2]  Número correlativo
 * [3]  Fecha emisión               DD/MM/YYYY
 * [4]  Fecha vencimiento           DD/MM/YYYY
 * [5]  Tipo comprobante            01=Factura, 03=Boleta, 07=NC, 08=ND
 * [6]  Serie                       F001, B001, etc.
 * [7]  Año DUA/DSI                 (vacío si no aplica)
 * [8]  Número                      número del comprobante
 * [9]  Tipo doc identidad emisor   6=RUC
 * [10] RUC emisor (proveedor)
 * [11] Razón social emisor
 * [12] Base imponible gravada
 * [13] IGV
 * [14] Base imponible inafecta
 * [15] Base imponible exonerada
 * [16] ISC
 * [17] Base imponible IVAP
 * [18] IVAP
 * [19] ICBPER
 * [20] Otros tributos
 * [21] Total comprobante
 * [22] Moneda
 * [23] Tipo de cambio
 * [24] Fecha emisión doc referencia
 * [25] Tipo doc referencia
 * [26] Serie doc referencia
 * [27] Número doc referencia
 * [28] Código detracción
 * [29] Número constancia detracción
 * [30] Fecha pago detracción
 * [31-37] Otros campos
 * [38] Indicador comprobante cancelado
 * [39] Estado (1=válido, 8=anulado)
 *
 * Formato RVIE (Registro de Ventas) - Estructura 14.1 PLE:
 * [0]  Período tributario
 * [1]  CUO
 * [2]  Número correlativo
 * [3]  Fecha emisión
 * [4]  Fecha vencimiento
 * [5]  Tipo comprobante
 * [6]  Serie
 * [7]  Número
 * [8]  Tipo doc identidad receptor  6=RUC, 1=DNI
 * [9]  RUC/DNI receptor (cliente)
 * [10] Razón social receptor
 * [11] Valor facturado exportación
 * [12] Base imponible gravada
 * [13] Descuento base imponible
 * [14] IGV
 * [15] Descuento IGV
 * [16] Base imponible inafecta
 * [17] Base imponible exonerada
 * [18] ISC
 * [19] Base imponible IVAP
 * [20] IVAP
 * [21] ICBPER
 * [22] Otros tributos
 * [23] Total comprobante
 * [24] Moneda
 * [25] Tipo de cambio
 * [26-] Otros campos
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

    console.log(`[SIRE Parser] ZIP entries (${entries.length}): ${entries.map(e => e.entryName).join(", ")}`);

    for (const entry of entries) {
      const name = entry.entryName.toLowerCase();

      // TXT pipe-delimited (formato PLE)
      if (name.endsWith(".txt") || name.endsWith(".csv")) {
        const content = entry.getData().toString("utf8");
        const lines = content.split("\n").filter(l => l.trim() && l.includes("|"));
        console.log(`[SIRE Parser] TXT ${name}: ${lines.length} líneas con pipes`);

        // Detect format from first data line
        const firstDataLine = lines.find(l => {
          const f = l.split("|");
          return f[0] && /^\d{11}$/.test(f[0].trim()); // RUC as first field = RVIE inconsistencias
        });
        const isRVIEFormat = firstDataLine !== undefined && lines[0]?.split("|")[0]?.trim() === "RUC";

        for (const line of lines) {
          const fields = line.split("|");
          let parsed: SireComprobanteData | null = null;

          if (isRVIEFormat) {
            // RVIE inconsistencias format: [0]=RUC emisor, [1]=razon, [2]=periodo, [3]=CUO, [4]=fecha, [6]=tipo, [7]=serie, [8]=numero
            parsed = parseRVIEInconsistenciasLine(fields, tipo);
          } else if (tipo === "propuesta-ventas") {
            parsed = parseRVIELine(fields);
          } else {
            parsed = parseRCELine(fields);
          }

          if (parsed) comprobantes.push(parsed);
        }
      }

      // Excel (.xlsx/.xls)
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const XLSX = require("xlsx");
          const wb = XLSX.read(entry.getData(), { type: "buffer" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];
          console.log(`[SIRE Parser] Excel ${name}: ${allRows.length} filas totales`);

          let startRow = 0;
          for (let i = 0; i < Math.min(5, allRows.length); i++) {
            const row = allRows[i];
            const firstCell = String(row[0] ?? "").trim();
            if (/^\d{6}$/.test(firstCell)) { startRow = i; break; }
            startRow = i + 1;
          }

          for (const row of allRows.slice(startRow)) {
            const parsed = tipo === "propuesta-ventas"
              ? parseExcelRVIERow(row)
              : parseExcelRCERow(row);
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

// ── RVIE Inconsistencias (formato real con datos) ─────────────────────────────
// Formato: [0]=RUC emisor, [1]=Razón social, [2]=Período, [3]=CUO,
//          [4]=Fecha emisión, [5]=Fecha vcto, [6]=Tipo CP, [7]=Serie, [8]=Número,
//          [9]=Tipo doc receptor, [10]=RUC/DNI receptor, [11]=Razón social receptor
//          [12..] = montos varios
function parseRVIEInconsistenciasLine(fields: string[], _tipo: string): SireComprobanteData | null {
  try {
    const f = fields.map(s => s.trim().replace(/\r/g, ""));
    if (f.length < 10) return null;

    // Skip header row
    if (f[0] === "RUC" || f[0] === "Periodo" || f[0] === "ID") return null;
    // RUC emisor must be 11 digits
    if (!f[0] || f[0].length !== 11 || isNaN(Number(f[0]))) return null;

    const rucEmisor = f[0];
    const razonSocialEmisor = f[1] || "";
    const periodo = f[2];
    const fechaEmision = f[4];
    const tipoComp = f[6] || "01";
    const serie = f[7];
    const numero = f[8];
    const rucReceptor = f[10] || "";
    const razonSocialReceptor = f[11] || "";

    if (!serie || !numero) return null;
    if (!periodo || !/^\d{6}$/.test(periodo)) return null;

    // Find montos in remaining fields
    let baseImponible = "0", igv = "0", total = "0", moneda = "PEN";
    const numericFields: number[] = [];
    for (let i = 12; i < f.length; i++) {
      const n = parseFloat(f[i]);
      if (!isNaN(n) && n > 0) numericFields.push(n);
      if (f[i] === "PEN" || f[i] === "USD") moneda = f[i];
    }
    if (numericFields.length >= 1) baseImponible = numericFields[0].toFixed(2);
    if (numericFields.length >= 2) igv = numericFields[1].toFixed(2);
    if (numericFields.length >= 3) total = numericFields[2].toFixed(2);
    else total = (parseFloat(baseImponible) + parseFloat(igv)).toFixed(2);

    return {
      periodo,
      fechaEmision: formatDate(fechaEmision),
      tipoComprobante: tipoComp,
      serie,
      numero,
      rucEmisor,
      razonSocial: razonSocialEmisor,
      baseImponible,
      igv,
      importeTotal: total,
      moneda,
    };
  } catch {
    return null;
  }
}

// ── RCE (Compras) TXT ──────────────────────────────────────────────────────────
function parseRCELine(fields: string[]): SireComprobanteData | null {
  try {
    const f = fields.map(s => s.trim().replace(/\r/g, ""));
    if (f.length < 13) return null;

    const periodo       = f[0];
    const fechaEmision  = f[3];
    const tipoComp      = f[5];
    const serie         = f[6];
    const numero        = f[8];
    const ruc           = f[10];
    const razonSocial   = f[11];
    const baseImponible = f[12];
    const igv           = f[13] ?? "0";
    const total         = f[21] ?? f[20] ?? "0";
    const moneda        = f[22] ?? "PEN";
    const estado        = f[f.length - 1] ?? "1";
    const codDetrac     = f[28] ?? "";
    const numConstancia = f[29] ?? "";
    const fechaPago     = f[30] ?? "";

    // Validaciones mínimas
    if (!numero || !serie) return null;
    if (!ruc || ruc.length < 8) return null;
    // Skip header rows that slipped through
    if (isNaN(Number(ruc)) && ruc.length > 0) return null;
    // Skip anulados (estado = 8)
    if (estado === "8") return null;

    return {
      periodo,
      fechaEmision: formatDate(fechaEmision),
      tipoComprobante: tipoComp || "01",
      serie,
      numero,
      rucEmisor: ruc,
      razonSocial,
      baseImponible: cleanNumber(baseImponible),
      igv: cleanNumber(igv),
      importeTotal: cleanNumber(total),
      moneda: moneda || "PEN",
      estado,
      codigoDetraccion: codDetrac,
      numeroConstanciaDetraccion: numConstancia,
      fechaPagoDetraccion: fechaPago,
    };
  } catch {
    return null;
  }
}

// ── RVIE (Ventas) TXT ──────────────────────────────────────────────────────────
function parseRVIELine(fields: string[]): SireComprobanteData | null {
  try {
    const f = fields.map(s => s.trim().replace(/\r/g, ""));
    if (f.length < 12) return null;

    const periodo       = f[0];
    const fechaEmision  = f[3];
    const tipoComp      = f[5];
    const serie         = f[6];
    const numero        = f[7];
    const rucReceptor   = f[9];   // cliente
    const razonSocial   = f[10];  // razón social cliente
    const baseImponible = f[12];
    const igv           = f[14] ?? "0";
    const total         = f[23] ?? f[22] ?? "0";
    const moneda        = f[24] ?? "PEN";
    const estado        = f[f.length - 1] ?? "1";

    if (!numero || !serie) return null;
    if (estado === "8") return null;

    return {
      periodo,
      fechaEmision: formatDate(fechaEmision),
      tipoComprobante: tipoComp || "01",
      serie,
      numero,
      rucEmisor: rucReceptor,  // en ventas, el "emisor" del XML es el cliente (receptor)
      razonSocial,
      baseImponible: cleanNumber(baseImponible),
      igv: cleanNumber(igv),
      importeTotal: cleanNumber(total),
      moneda: moneda || "PEN",
      estado,
    };
  } catch {
    return null;
  }
}

// ── RCE (Compras) Excel ────────────────────────────────────────────────────────
function parseExcelRCERow(row: string[]): SireComprobanteData | null {
  try {
    if (!row || row.length < 10) return null;
    const f = row.map(v => String(v ?? "").trim());

    // Excel RCE columns (same order as TXT):
    // [0] Período, [1] CUO, [2] Correlativo, [3] Fecha emisión, [4] Fecha venc,
    // [5] Tipo CP, [6] Serie, [7] Año DUA, [8] Número, [9] Tipo doc,
    // [10] RUC emisor, [11] Razón social, [12] Base imponible, [13] IGV,
    // ... [21] Total, [22] Moneda

    const periodo       = f[0];
    const fechaEmision  = f[3];
    const tipoComp      = f[5];
    const serie         = f[6];
    const numero        = f[8];
    const ruc           = f[10];
    const razonSocial   = f[11];
    const baseImponible = f[12];
    const igv           = f[13] ?? "0";
    const total         = f[21] ?? f[20] ?? "0";
    const moneda        = f[22] ?? "PEN";

    if (!numero || !serie) return null;
    if (!periodo || !/^\d{6}$/.test(String(periodo))) return null;
    if (!ruc || String(ruc).length < 8) return null;
    if (isNaN(Number(String(ruc)))) return null;

    return {
      periodo: String(periodo),
      fechaEmision: formatDate(String(fechaEmision)),
      tipoComprobante: String(tipoComp) || "01",
      serie: String(serie),
      numero: String(numero),
      rucEmisor: String(ruc),
      razonSocial: String(razonSocial),
      baseImponible: cleanNumber(String(baseImponible)),
      igv: cleanNumber(String(igv)),
      importeTotal: cleanNumber(String(total)),
      moneda: String(moneda) || "PEN",
    };
  } catch {
    return null;
  }
}

// ── RVIE (Ventas) Excel ────────────────────────────────────────────────────────
function parseExcelRVIERow(row: string[]): SireComprobanteData | null {
  try {
    if (!row || row.length < 10) return null;
    const f = row.map(v => String(v ?? "").trim());

    const periodo       = f[0];
    const fechaEmision  = f[3];
    const tipoComp      = f[5];
    const serie         = f[6];
    const numero        = f[7];
    const rucReceptor   = f[9];
    const razonSocial   = f[10];
    const baseImponible = f[12];
    const igv           = f[14] ?? "0";
    const total         = f[23] ?? f[22] ?? "0";
    const moneda        = f[24] ?? "PEN";

    if (!numero || !serie) return null;
    if (!periodo || !/^\d{6}$/.test(String(periodo))) return null;

    return {
      periodo: String(periodo),
      fechaEmision: formatDate(String(fechaEmision)),
      tipoComprobante: String(tipoComp) || "01",
      serie: String(serie),
      numero: String(numero),
      rucEmisor: String(rucReceptor),
      razonSocial: String(razonSocial),
      baseImponible: cleanNumber(String(baseImponible)),
      igv: cleanNumber(String(igv)),
      importeTotal: cleanNumber(String(total)),
      moneda: String(moneda) || "PEN",
    };
  } catch {
    return null;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(dateStr?: string): string {
  if (!dateStr || dateStr.trim() === "") return new Date().toISOString().split("T")[0];
  const s = dateStr.trim();
  // DD/MM/YYYY → YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // YYYYMMDD → YYYY-MM-DD
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Excel serial date number
  const num = Number(s);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    // Excel date serial → JS Date
    const d = new Date((num - 25569) * 86400 * 1000);
    return d.toISOString().split("T")[0];
  }
  return new Date().toISOString().split("T")[0];
}

function cleanNumber(s?: string): string {
  if (!s || s.trim() === "" || s.trim() === "-") return "0";
  const n = parseFloat(s.replace(/,/g, ""));
  if (isNaN(n)) return "0";
  return n.toFixed(2);
}
