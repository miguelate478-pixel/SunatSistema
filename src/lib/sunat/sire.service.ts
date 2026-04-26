/**
 * SUNAT SIRE Service — Capa SIRE (RCE + RVIE)
 *
 * SIRE = Sistema Integrado de Registros Electrónicos
 *   - RCE  = Registro de Compras Electrónico
 *   - RVIE = Registro de Ventas e Ingresos Electrónico
 *
 * ─────────────────────────────────────────────────────────────────
 * ESTADO REAL DE LA API SIRE (Abril 2026)
 * ─────────────────────────────────────────────────────────────────
 *
 * ✅ LO QUE SIRE SÍ PERMITE (vía portal y API):
 *   - Consultar la propuesta de compras (RCE) generada por SUNAT para un período
 *   - Consultar la propuesta de ventas (RVIE) generada por SUNAT para un período
 *   - Agregar/modificar/eliminar líneas en la propuesta
 *   - Generar el registro definitivo (cerrar el período)
 *   - Descargar el archivo TXT/Excel del registro generado
 *   - Consultar tickets de procesamiento
 *
 * ❌ LO QUE SIRE NO PERMITE:
 *   - Listar comprobantes recibidos en tiempo real (eso es CPE, y CPE tampoco lo permite para receptores)
 *   - Acceso sin credenciales SOL válidas
 *   - Modificar períodos ya cerrados/presentados
 *
 * ⚠️ ESTADO DE LA API SIRE:
 *   SUNAT tiene una API REST para SIRE pero NO está documentada públicamente.
 *   El acceso programático existe (lo usan ERPs como SAP, Oracle) pero requiere
 *   un convenio formal con SUNAT o uso del cliente desktop oficial.
 *
 *   Los endpoints conocidos por ingeniería inversa del portal son:
 *   Base: https://api-sire.sunat.gob.pe/v1/contribuyente/{ruc}/...
 *   Token: mismo OAuth2 con scope=https://api-sire.sunat.gob.pe
 *
 * ─────────────────────────────────────────────────────────────────
 * FLUJO ALTERNATIVO OPERATIVO (lo que implementamos)
 * ─────────────────────────────────────────────────────────────────
 *
 * Dado que la API SIRE no está documentada públicamente, el flujo
 * que implementamos es:
 *
 * 1. El usuario ingresa/importa sus comprobantes en el sistema
 *    (manual, CSV, o desde XML descargado de CPE)
 * 2. El sistema genera el formato TXT compatible con SIRE/PLE
 *    (formato oficial SUNAT para RCE y RVIE)
 * 3. El usuario descarga el TXT y lo sube al portal SIRE
 *    o al cliente desktop de SUNAT
 *
 * Este es el flujo que usan la mayoría de contadores en Perú
 * con software contable (Concar, Siscont, etc.)
 *
 * Cuando SUNAT publique la documentación oficial de su API SIRE,
 * se puede reemplazar el paso 3 por una llamada directa.
 * ─────────────────────────────────────────────────────────────────
 */

import { logger } from "@/lib/logger";
import prisma from "@/lib/db/prisma";

export interface SireRegistroCompra {
  periodo: string;           // "202604"
  cuo: string;               // Código Único de Operación
  correlativo: string;       // Número correlativo
  fechaEmision: string;      // "26/04/2026"
  fechaVencimiento: string;  // "26/05/2026" o vacío
  tipoComprobante: string;   // "01" = Factura
  serie: string;
  numero: string;
  tipoDocProveedor: string;  // "6" = RUC
  rucProveedor: string;
  razonSocialProveedor: string;
  baseImponible: number;
  igv: number;
  total: number;
  moneda: string;            // "PEN" o "USD"
  tipoCambio: number;
  estadoComprobante: string; // "1" = Anotado
}

export interface SireRegistroVenta {
  periodo: string;
  cuo: string;
  correlativo: string;
  fechaEmision: string;
  fechaVencimiento: string;
  tipoComprobante: string;
  serie: string;
  numero: string;
  tipoDocCliente: string;
  docCliente: string;
  razonSocialCliente: string;
  baseImponible: number;
  igv: number;
  total: number;
  moneda: string;
  tipoCambio: number;
  estadoComprobante: string;
}

export interface SireGenerationResult {
  companyId: string;
  periodo: string;
  tipo: "RCE" | "RVIE";
  registros: number;
  contenidoTxt: string;
  filename: string;
  generadoAt: string;
}

// SUNAT tipo comprobante codes
const TIPO_CP_MAP: Record<string, string> = {
  FACTURA:      "01",
  BOLETA:       "03",
  NOTA_CREDITO: "07",
  NOTA_DEBITO:  "08",
  RECIBO:       "RC",
};

function formatDate(date: Date): string {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function formatPeriodo(periodo: string): string {
  // "2026-04" → "202604"
  return periodo.replace("-", "");
}

/**
 * Genera el archivo TXT del Registro de Compras Electrónico (RCE)
 * en formato compatible con SIRE/PLE de SUNAT.
 *
 * Formato: pipe-delimited según estructura 8.1 del PLE
 */
export async function generarRCE(
  companyId: string,
  periodo: string // "2026-04"
): Promise<SireGenerationResult> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("Empresa no encontrada");

  const [year, month] = periodo.split("-");
  const fechaInicio = new Date(`${year}-${month}-01`);
  const fechaFin = new Date(parseInt(year), parseInt(month), 0); // último día del mes

  // Obtener comprobantes de compra del período
  const vouchers = await prisma.voucher.findMany({
    where: {
      companyId,
      deletedAt: null,
      rucReceptor: company.ruc, // compras = empresa es receptora
      fechaEmision: { gte: fechaInicio, lte: fechaFin },
    },
    orderBy: { fechaEmision: "asc" },
  });

  logger.info("[SIRE:RCE] Generating RCE", { companyId, periodo, vouchers: vouchers.length });

  const periodoFmt = formatPeriodo(periodo);
  const lines: string[] = [];

  vouchers.forEach((v, idx) => {
    const correlativo = String(idx + 1).padStart(10, "0");
    const tipoCP = TIPO_CP_MAP[v.tipo] ?? "01";
    const fechaEm = formatDate(v.fechaEmision);
    const fechaVenc = v.fechaVencimiento ? formatDate(v.fechaVencimiento) : "";
    const baseImp = Number(v.subtotal).toFixed(2);
    const igv = Number(v.igv).toFixed(2);
    const total = Number(v.total).toFixed(2);
    const moneda = v.moneda === "USD" ? "2" : "1"; // 1=PEN, 2=USD
    const tipoCambio = v.moneda === "USD" ? "3.800" : "1.000"; // tipo de cambio referencial

    // Estructura 8.1 RCE — campos separados por pipe
    const line = [
      periodoFmt,           // 1. Período
      correlativo,          // 2. CUO
      correlativo,          // 3. Correlativo
      fechaEm,              // 4. Fecha emisión
      fechaVenc,            // 5. Fecha vencimiento
      tipoCP,               // 6. Tipo comprobante
      v.serie,              // 7. Serie
      v.numero,             // 8. Número
      "",                   // 9. Año DUA/DSI
      "6",                  // 10. Tipo doc proveedor (6=RUC)
      v.rucEmisor,          // 11. RUC proveedor
      v.razonSocialEmisor,  // 12. Razón social proveedor
      baseImp,              // 13. Base imponible BI gravada
      igv,                  // 14. IGV
      "0.00",               // 15. Base imponible BI no gravada
      "0.00",               // 16. ISC
      "0.00",               // 17. ICBPER
      "0.00",               // 18. Otros tributos
      total,                // 19. Total
      moneda,               // 20. Moneda
      tipoCambio,           // 21. Tipo de cambio
      "",                   // 22. Fecha emisión doc modificado
      "",                   // 23. Tipo doc modificado
      "",                   // 24. Serie doc modificado
      "",                   // 25. Código dep. aduanera
      "",                   // 26. Número doc modificado
      "",                   // 27. Fecha emisión DUA/DSI
      "",                   // 28. Número DUA/DSI
      "1",                  // 29. Estado (1=anotado)
      "",                   // 30. Indicador DUA/DSI
    ].join("|");

    lines.push(line);
  });

  const contenidoTxt = lines.join("\r\n");
  const filename = `LE${company.ruc}${periodoFmt}00080100001100_1_1.txt`;

  return {
    companyId,
    periodo,
    tipo: "RCE",
    registros: vouchers.length,
    contenidoTxt,
    filename,
    generadoAt: new Date().toISOString(),
  };
}

/**
 * Genera el archivo TXT del Registro de Ventas e Ingresos Electrónico (RVIE)
 * en formato compatible con SIRE/PLE de SUNAT.
 *
 * Formato: pipe-delimited según estructura 14.1 del PLE
 */
export async function generarRVIE(
  companyId: string,
  periodo: string // "2026-04"
): Promise<SireGenerationResult> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("Empresa no encontrada");

  const [year, month] = periodo.split("-");
  const fechaInicio = new Date(`${year}-${month}-01`);
  const fechaFin = new Date(parseInt(year), parseInt(month), 0);

  // Obtener comprobantes de venta del período
  const vouchers = await prisma.voucher.findMany({
    where: {
      companyId,
      deletedAt: null,
      rucEmisor: company.ruc, // ventas = empresa es emisora
      fechaEmision: { gte: fechaInicio, lte: fechaFin },
    },
    orderBy: { fechaEmision: "asc" },
  });

  logger.info("[SIRE:RVIE] Generating RVIE", { companyId, periodo, vouchers: vouchers.length });

  const periodoFmt = formatPeriodo(periodo);
  const lines: string[] = [];

  vouchers.forEach((v, idx) => {
    const correlativo = String(idx + 1).padStart(10, "0");
    const tipoCP = TIPO_CP_MAP[v.tipo] ?? "01";
    const fechaEm = formatDate(v.fechaEmision);
    const fechaVenc = v.fechaVencimiento ? formatDate(v.fechaVencimiento) : "";
    const baseImp = Number(v.subtotal).toFixed(2);
    const igv = Number(v.igv).toFixed(2);
    const total = Number(v.total).toFixed(2);
    const moneda = v.moneda === "USD" ? "2" : "1";
    const tipoCambio = v.moneda === "USD" ? "3.800" : "1.000";

    // Tipo doc cliente: 6=RUC, 1=DNI, 0=varios
    const tipoDocCliente = v.rucReceptor?.length === 11 ? "6" : v.rucReceptor?.length === 8 ? "1" : "0";

    // Estructura 14.1 RVIE
    const line = [
      periodoFmt,              // 1. Período
      correlativo,             // 2. CUO
      correlativo,             // 3. Correlativo
      fechaEm,                 // 4. Fecha emisión
      fechaVenc,               // 5. Fecha vencimiento
      tipoCP,                  // 6. Tipo comprobante
      v.serie,                 // 7. Serie
      "",                      // 8. Año emisión DUA
      v.numero,                // 9. Número
      tipoDocCliente,          // 10. Tipo doc cliente
      v.rucReceptor ?? "",     // 11. Número doc cliente
      v.razonSocialReceptor ?? "", // 12. Razón social cliente
      baseImp,                 // 13. Base imponible BI gravada
      "0.00",                  // 14. Descuento BI gravada
      igv,                     // 15. IGV
      "0.00",                  // 16. Descuento IGV
      "0.00",                  // 17. Base imponible BI exonerada
      "0.00",                  // 18. Descuento BI exonerada
      "0.00",                  // 19. Base imponible BI inafecta
      "0.00",                  // 20. Descuento BI inafecta
      "0.00",                  // 21. ISC
      "0.00",                  // 22. Base imponible ICBPER
      "0.00",                  // 23. ICBPER
      "0.00",                  // 24. Otros tributos
      total,                   // 25. Total
      moneda,                  // 26. Moneda
      tipoCambio,              // 27. Tipo de cambio
      "",                      // 28. Fecha emisión doc modificado
      "",                      // 29. Tipo doc modificado
      "",                      // 30. Serie doc modificado
      "",                      // 31. Número doc modificado
      "1",                     // 32. Estado (1=anotado)
    ].join("|");

    lines.push(line);
  });

  const contenidoTxt = lines.join("\r\n");
  const filename = `LE${company.ruc}${periodoFmt}00140100001100_1_1.txt`;

  return {
    companyId,
    periodo,
    tipo: "RVIE",
    registros: vouchers.length,
    contenidoTxt,
    filename,
    generadoAt: new Date().toISOString(),
  };
}
