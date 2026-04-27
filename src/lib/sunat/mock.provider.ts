/**
 * Mock SUNAT Provider
 * Returns realistic simulated data for development and demo.
 * In production: set SUNAT_PROVIDER=real and configure credentials.
 */

import type { ISunatProvider, SunatDocument, DownloadResult, SunatQueryParams } from "./provider.interface";

// Realistic mock suppliers
const MOCK_SUPPLIERS = [
  { ruc: "20100070970", nombre: "DISTRIBUIDORA NORTE S.A.C." },
  { ruc: "20503840121", nombre: "SUMINISTROS TECH PERU S.A." },
  { ruc: "20601234567", nombre: "IMPORTACIONES GLOBALES E.I.R.L." },
  { ruc: "20456789012", nombre: "SERVICIOS DIGITALES PERU S.A.C." },
  { ruc: "20312345678", nombre: "CONSULTORES ANDINOS S.R.L." },
];

const MOCK_CUSTOMERS = [
  { ruc: "20301234567", nombre: "MINERA ANDAHUAYLAS S.A." },
  { ruc: "20456123789", nombre: "GRUPO EMPRESARIAL NORTE S.A.C." },
  { ruc: "20567890123", nombre: "CONSTRUCTORA LIMA S.A." },
];

const DOC_TYPES = ["01", "01", "01", "03", "07"]; // mostly facturas

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateDocumentsForPeriod(
  ruc: string,
  fechaInicio: string,
  fechaFin: string,
  isCompra: boolean
): SunatDocument[] {
  const start = new Date(fechaInicio);
  const end = new Date(fechaFin);
  const days = Math.ceil((end.getTime() - start.getTime()) / 86400000);

  if (days <= 0) return [];

  // Seed based on ruc + period so results are consistent
  const seed = parseInt(ruc.slice(-4)) + start.getMonth() + start.getFullYear() * 12;
  const count = Math.floor(seededRandom(seed) * 8) + 3; // 3-10 docs per period

  const docs: SunatDocument[] = [];
  const parties = isCompra ? MOCK_SUPPLIERS : MOCK_CUSTOMERS;

  for (let i = 0; i < count; i++) {
    const dayOffset = Math.floor(seededRandom(seed + i) * days);
    const docDate = new Date(start);
    docDate.setDate(docDate.getDate() + dayOffset);

    const party = parties[Math.floor(seededRandom(seed + i + 100) * parties.length)];
    const tipoDoc = DOC_TYPES[Math.floor(seededRandom(seed + i + 200) * DOC_TYPES.length)];
    const serie = tipoDoc === "01" ? "F001" : tipoDoc === "03" ? "B001" : "FC01";
    const numero = String(Math.floor(seededRandom(seed + i + 300) * 90000) + 10000).padStart(8, "0");

    docs.push({
      voucherId: "",
      serie,
      numero,
      tipo: tipoDoc,
      rucEmisor: isCompra ? party.ruc : ruc,
      razonSocialEmisor: isCompra ? party.nombre : "EMPRESA DEMO S.A.C.",
      fechaEmision: docDate.toISOString().split("T")[0],
    });
  }

  return docs;
}

export class MockSunatProvider implements ISunatProvider {
  async downloadDocument(doc: SunatDocument, tipo: "XML" | "PDF" | "CDR"): Promise<DownloadResult> {
    await new Promise((r) => setTimeout(r, 80 + Math.random() * 120));
    const filename = `${doc.serie}-${doc.numero}.${tipo === "PDF" ? "pdf" : "xml"}`;
    return {
      voucherId: doc.voucherId,
      tipo,
      content: Buffer.from(this.generateMockContent(tipo, doc), "utf8"),
      filename,
      mimeType: tipo === "PDF" ? "application/pdf" : "application/xml",
      success: true,
    };
  }

  async queryDocuments(params: SunatQueryParams): Promise<SunatDocument[]> {
    await new Promise((r) => setTimeout(r, 200));
    // Generate realistic mock documents for the requested period
    // isCompra = we are querying as receptor (rucReceptor = params.ruc)
    return generateDocumentsForPeriod(params.ruc, params.fechaInicio ?? "", params.fechaFin ?? "", true);
  }

  async validateDocument(): Promise<{ valid: boolean; estado: string }> {
    await new Promise((r) => setTimeout(r, 80));
    return { valid: true, estado: "ACEPTADO" };
  }

  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: "Mock provider activo — datos simulados para demo" };
  }

  private generateMockContent(tipo: string, doc: SunatDocument): string {
    if (tipo === "PDF") return `%PDF-1.4 Mock PDF ${doc.serie}-${doc.numero}`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <ID>${doc.serie}-${doc.numero}</ID>
  <IssueDate>${doc.fechaEmision}</IssueDate>
  <AccountingSupplierParty><Party><PartyTaxScheme><CompanyID>${doc.rucEmisor}</CompanyID></PartyTaxScheme></Party></AccountingSupplierParty>
  <!-- Mock content — ControlSUNAT Demo -->
</Invoice>`;
  }
}
