/**
 * SUNAT XML Parser
 *
 * Parsea XMLs de comprobantes electrónicos SUNAT (UBL 2.1)
 * y extrae los datos estructurados para registrar en DB.
 *
 * Soporta:
 *   - Facturas (01)
 *   - Boletas (03)
 *   - Notas de Crédito (07)
 *   - Notas de Débito (08)
 *   - Resúmenes diarios (RC)
 *
 * No usa librerías externas — parseo con regex sobre el XML string
 * para evitar dependencias pesadas en el bundle de Next.js.
 */

export interface ParsedVoucher {
  tipo: string;
  serie: string;
  numero: string;
  fechaEmision: string;       // "YYYY-MM-DD"
  fechaVencimiento?: string;  // "YYYY-MM-DD"
  rucEmisor: string;
  razonSocialEmisor: string;
  rucReceptor: string;
  razonSocialReceptor: string;
  moneda: string;             // "PEN" | "USD"
  subtotal: number;
  igv: number;
  total: number;
  afectoDetraccion: boolean;
  porcentajeDetraccion?: number;
  montoDetraccion?: number;
  items: ParsedItem[];
  xmlRaw: string;
}

export interface ParsedItem {
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  subtotal: number;
  igv: number;
  total: number;
}

// SUNAT tipo comprobante codes → internal
const TIPO_MAP: Record<string, string> = {
  "01": "FACTURA",
  "03": "BOLETA",
  "07": "NOTA_CREDITO",
  "08": "NOTA_DEBITO",
  "RC": "RECIBO",
  "RA": "RESUMEN",
};

function extractTag(xml: string, tag: string): string {
  // Try with namespace prefix first, then without
  const patterns = [
    new RegExp(`<[^:>]*:${tag}[^>]*>([^<]*)<`, "i"),
    new RegExp(`<${tag}[^>]*>([^<]*)<`, "i"),
  ];
  for (const p of patterns) {
    const m = xml.match(p);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return "";
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const p = new RegExp(`<[^:>]*:?${tag}[^>]*${attr}="([^"]*)"`, "i");
  const m = xml.match(p);
  return m?.[1]?.trim() ?? "";
}

function extractAllTags(xml: string, tag: string): string[] {
  const results: string[] = [];
  const p = new RegExp(`<[^:>]*:?${tag}[^>]*>([^<]*)<`, "gi");
  let m;
  while ((m = p.exec(xml)) !== null) {
    if (m[1]?.trim()) results.push(m[1].trim());
  }
  return results;
}

function extractBlock(xml: string, tag: string): string {
  const p = new RegExp(`<[^:>]*:?${tag}[^>]*>([\\s\\S]*?)<\/[^:>]*:?${tag}>`, "i");
  const m = xml.match(p);
  return m?.[1] ?? "";
}

function extractAllBlocks(xml: string, tag: string): string[] {
  const results: string[] = [];
  const p = new RegExp(`<[^:>]*:?${tag}[^>]*>([\\s\\S]*?)<\/[^:>]*:?${tag}>`, "gi");
  let m;
  while ((m = p.exec(xml)) !== null) {
    results.push(m[1]);
  }
  return results;
}

/**
 * Detecta el tipo de comprobante desde el XML
 */
function detectTipo(xml: string): string {
  // Try InvoiceTypeCode first
  const typeCode = extractTag(xml, "InvoiceTypeCode") ||
                   extractTag(xml, "CreditNoteTypeCode") ||
                   extractTag(xml, "DebitNoteTypeCode");

  if (typeCode) return TIPO_MAP[typeCode] ?? typeCode;

  // Detect from root element
  if (xml.includes("<Invoice ") || xml.includes("<Invoice>")) return "FACTURA";
  if (xml.includes("<CreditNote ") || xml.includes("<CreditNote>")) return "NOTA_CREDITO";
  if (xml.includes("<DebitNote ") || xml.includes("<DebitNote>")) return "NOTA_DEBITO";

  return "FACTURA";
}

/**
 * Extrae serie y número del ID del comprobante
 * Formato SUNAT: "F001-00012345" o "B001-00012345"
 */
function extractSerieNumero(id: string): { serie: string; numero: string } {
  const parts = id.split("-");
  if (parts.length >= 2) {
    return { serie: parts[0], numero: parts.slice(1).join("-") };
  }
  return { serie: id.slice(0, 4), numero: id.slice(4) };
}

/**
 * Parsea un XML de comprobante SUNAT y retorna los datos estructurados.
 * Retorna null si el XML no es un comprobante válido.
 */
export function parseVoucherXML(xmlContent: string): ParsedVoucher | null {
  try {
    const xml = xmlContent;

    // Extract ID (serie-numero)
    const id = extractTag(xml, "ID");
    if (!id) return null;
    const { serie, numero } = extractSerieNumero(id);

    const tipo = detectTipo(xml);

    // Dates
    const fechaEmision = extractTag(xml, "IssueDate");
    const fechaVencimiento = extractTag(xml, "DueDate") || undefined;

    // Emisor (AccountingSupplierParty)
    const emisorBlock = extractBlock(xml, "AccountingSupplierParty");
    const rucEmisor = extractTag(emisorBlock, "CompanyID") ||
                      extractTag(emisorBlock, "ID") ||
                      extractTag(xml, "CompanyID");
    const razonSocialEmisor = extractTag(emisorBlock, "RegistrationName") ||
                               extractTag(emisorBlock, "Name") ||
                               extractTag(xml, "RegistrationName");

    // Receptor (AccountingCustomerParty)
    const receptorBlock = extractBlock(xml, "AccountingCustomerParty");
    const rucReceptor = extractTag(receptorBlock, "CompanyID") ||
                        extractTag(receptorBlock, "ID") || "";
    const razonSocialReceptor = extractTag(receptorBlock, "RegistrationName") ||
                                 extractTag(receptorBlock, "Name") || "";

    // Currency
    const monedaCode = extractAttr(xml, "DocumentCurrencyCode", "listID") ||
                       extractTag(xml, "DocumentCurrencyCode") || "PEN";
    const moneda = monedaCode === "USD" ? "USD" : "PEN";

    // Amounts — try multiple UBL paths
    const legalMonetaryBlock = extractBlock(xml, "LegalMonetaryTotal");
    const taxTotalBlock = extractBlock(xml, "TaxTotal");

    let subtotal = parseFloat(
      extractTag(legalMonetaryBlock, "LineExtensionAmount") ||
      extractTag(xml, "LineExtensionAmount") || "0"
    );
    let igv = parseFloat(
      extractTag(taxTotalBlock, "TaxAmount") ||
      extractTag(xml, "TaxAmount") || "0"
    );
    let total = parseFloat(
      extractTag(legalMonetaryBlock, "PayableAmount") ||
      extractTag(xml, "PayableAmount") || "0"
    );

    // Fallback: calculate from total if subtotal is 0
    if (subtotal === 0 && total > 0) {
      subtotal = Math.round((total / 1.18) * 100) / 100;
      igv = Math.round((total - subtotal) * 100) / 100;
    }

    // Detracción
    let afectoDetraccion = false;
    let porcentajeDetraccion: number | undefined;
    let montoDetraccion: number | undefined;

    const detraccionBlock = extractBlock(xml, "PaymentTerms");
    if (detraccionBlock && detraccionBlock.includes("Detraccion")) {
      afectoDetraccion = true;
      const pct = parseFloat(extractTag(detraccionBlock, "PaymentPercent") || "0");
      const monto = parseFloat(extractTag(detraccionBlock, "Amount") || "0");
      if (pct > 0) porcentajeDetraccion = pct;
      if (monto > 0) montoDetraccion = monto;
    }

    // Line items
    const lineBlocks = extractAllBlocks(xml, "InvoiceLine")
      .concat(extractAllBlocks(xml, "CreditNoteLine"))
      .concat(extractAllBlocks(xml, "DebitNoteLine"));

    const items: ParsedItem[] = lineBlocks.map((block) => {
      const descripcion = extractTag(block, "Description") || extractTag(block, "Name") || "";
      const cantidad = parseFloat(extractTag(block, "InvoicedQuantity") || extractTag(block, "Quantity") || "1");
      const unidad = extractAttr(block, "InvoicedQuantity", "unitCode") || "NIU";
      const precioUnitario = parseFloat(extractTag(block, "PriceAmount") || "0");
      const lineTotal = parseFloat(extractTag(block, "LineExtensionAmount") || "0");
      const lineIgv = parseFloat(extractTag(extractBlock(block, "TaxTotal"), "TaxAmount") || "0");

      return {
        descripcion,
        cantidad,
        unidad,
        precioUnitario,
        subtotal: lineTotal,
        igv: lineIgv,
        total: lineTotal + lineIgv,
      };
    });

    if (!rucEmisor || !fechaEmision) return null;

    return {
      tipo,
      serie,
      numero,
      fechaEmision,
      fechaVencimiento,
      rucEmisor,
      razonSocialEmisor: razonSocialEmisor || rucEmisor,
      rucReceptor,
      razonSocialReceptor: razonSocialReceptor || rucReceptor,
      moneda,
      subtotal,
      igv,
      total,
      afectoDetraccion,
      porcentajeDetraccion,
      montoDetraccion,
      items,
      xmlRaw: xmlContent,
    };
  } catch {
    return null;
  }
}
