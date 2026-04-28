/* eslint-disable @typescript-eslint/no-explicit-any */
import AdmZip from "adm-zip";
import { parseStringPromise } from "xml2js";

export interface ComprobanteData {
  rucEmisor?: string;
  razonSocial?: string;
  tipoComprobante?: string;
  serie?: string;
  numero?: string;
  fechaEmision?: string;
  moneda?: string;
  baseImponible?: string;
  igv?: string;
  importeTotal?: string;
}

export async function parseXmlFromZipBuffer(
  zipBuffer: Buffer,
  tipo: string
): Promise<ComprobanteData[]> {
  try {
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    const comprobantes: ComprobanteData[] = [];

    for (const entry of zipEntries) {
      if (entry.entryName.toLowerCase().endsWith(".xml")) {
        try {
          const xmlContent = entry.getData().toString("utf8");
          const parsed = await parseStringPromise(xmlContent);

          // Intentar extraer datos del XML
          const comprobante = extractComprobanteData(parsed, tipo);
          if (comprobante) {
            comprobantes.push(comprobante);
          }
        } catch (error) {
          console.error(`Error parsing XML ${entry.entryName}:`, error);
        }
      }
    }

    console.log(`[XML Processor] Procesados ${comprobantes.length} comprobantes del ZIP`);
    return comprobantes;
  } catch (error) {
    console.error("Error processing ZIP:", error);
    throw new Error(`Failed to process ZIP file: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

function extractComprobanteData(parsed: any, tipo: string): ComprobanteData | null {
  try {
    // Intentar diferentes estructuras de XML según el tipo
    let root = parsed;

    // Buscar el nodo raíz del comprobante
    if (parsed.Invoice) root = parsed.Invoice;
    else if (parsed.CreditNote) root = parsed.CreditNote;
    else if (parsed.DebitNote) root = parsed.DebitNote;
    else if (parsed["cac:Invoice"]) root = parsed["cac:Invoice"];

    // Extraer datos básicos
    const rucEmisor = extractValue(root, [
      "cac:AccountingSupplierParty.cac:Party.cac:PartyIdentification.cbc:ID",
      "AccountingSupplierParty.Party.PartyIdentification.ID",
      "cac:AccountingSupplierParty.0.cac:Party.0.cac:PartyIdentification.0.cbc:ID.0",
    ]);

    const razonSocial = extractValue(root, [
      "cac:AccountingSupplierParty.cac:Party.cac:PartyLegalEntity.cbc:RegistrationName",
      "AccountingSupplierParty.Party.PartyLegalEntity.RegistrationName",
      "cac:AccountingSupplierParty.0.cac:Party.0.cac:PartyLegalEntity.0.cbc:RegistrationName.0",
    ]);

    const tipoComprobante = extractValue(root, [
      "cbc:InvoiceTypeCode",
      "InvoiceTypeCode",
      "cbc:InvoiceTypeCode.0",
    ]);

    const serie = extractValue(root, [
      "cbc:ID",
      "ID",
      "cbc:ID.0",
    ])?.split("-")[0];

    const numero = extractValue(root, [
      "cbc:ID",
      "ID",
      "cbc:ID.0",
    ])?.split("-")[1];

    const fechaEmision = extractValue(root, [
      "cbc:IssueDate",
      "IssueDate",
      "cbc:IssueDate.0",
    ]);

    const moneda = extractValue(root, [
      "cbc:DocumentCurrencyCode",
      "DocumentCurrencyCode",
      "cbc:DocumentCurrencyCode.0",
    ]) || "PEN";

    const importeTotal = extractValue(root, [
      "cac:LegalMonetaryTotal.cbc:PayableAmount",
      "LegalMonetaryTotal.PayableAmount",
      "cac:LegalMonetaryTotal.0.cbc:PayableAmount.0._",
      "cac:LegalMonetaryTotal.0.cbc:PayableAmount.0",
    ]);

    // Buscar IGV en los totales de impuestos
    let igv = "0";
    const taxTotals = root["cac:TaxTotal"] || root.TaxTotal || [];
    const taxTotalArray = Array.isArray(taxTotals) ? taxTotals : [taxTotals];
    
    for (const taxTotal of taxTotalArray) {
      const taxSubtotals = taxTotal["cac:TaxSubtotal"] || taxTotal.TaxSubtotal || [];
      const taxSubtotalArray = Array.isArray(taxSubtotals) ? taxSubtotals : [taxSubtotals];
      
      for (const subtotal of taxSubtotalArray) {
        const taxCategory = subtotal["cac:TaxCategory"] || subtotal.TaxCategory;
        const taxScheme = taxCategory?.["cac:TaxScheme"] || taxCategory?.TaxScheme;
        const taxId = taxScheme?.["cbc:ID"] || taxScheme?.ID;
        
        if (taxId && (taxId[0] === "1000" || taxId === "1000")) {
          igv = extractValue(subtotal, [
            "cbc:TaxAmount",
            "TaxAmount",
            "cbc:TaxAmount.0._",
            "cbc:TaxAmount.0",
          ]) || "0";
          break;
        }
      }
    }

    const baseImponible = importeTotal && igv 
      ? (parseFloat(importeTotal) - parseFloat(igv)).toFixed(2)
      : "0";

    return {
      rucEmisor,
      razonSocial,
      tipoComprobante,
      serie,
      numero,
      fechaEmision,
      moneda,
      baseImponible,
      igv,
      importeTotal,
    };
  } catch (error) {
    console.error("Error extracting comprobante data:", error);
    return null;
  }
}

function extractValue(obj: any, paths: string[]): string | undefined {
  for (const path of paths) {
    const parts = path.split(".");
    let current = obj;
    
    for (const part of parts) {
      if (current && typeof current === "object") {
        current = current[part];
      } else {
        current = undefined;
        break;
      }
    }
    
    if (current !== undefined) {
      // Si es un array, tomar el primer elemento
      if (Array.isArray(current)) {
        current = current[0];
      }
      // Si es un objeto con _, tomar ese valor
      if (typeof current === "object" && current._) {
        return String(current._);
      }
      // Si es un string o número, retornarlo
      if (typeof current === "string" || typeof current === "number") {
        return String(current);
      }
    }
  }
  
  return undefined;
}
