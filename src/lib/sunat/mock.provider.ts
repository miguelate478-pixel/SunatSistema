/**
 * Mock SUNAT Provider
 * Simulates SUNAT responses for development and demo.
 * Replace with RealSunatProvider for production.
 */

import type { ISunatProvider, SunatDocument, DownloadResult } from "./provider.interface";

export class MockSunatProvider implements ISunatProvider {
  async downloadDocument(doc: SunatDocument, tipo: "XML" | "PDF" | "CDR"): Promise<DownloadResult> {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 150 + Math.random() * 200));

    const filename = `${doc.serie}-${doc.numero}.${tipo === "PDF" ? "pdf" : "xml"}`;
    const content = this.generateMockContent(tipo, doc);

    return {
      voucherId: doc.voucherId,
      tipo,
      content: Buffer.from(content, "utf8"),
      filename,
      mimeType: tipo === "PDF" ? "application/pdf" : "application/xml",
      success: true,
    };
  }

  async queryDocuments(): Promise<SunatDocument[]> {
    await new Promise((r) => setTimeout(r, 100));
    // Returns empty — real data comes from DB
    return [];
  }

  async validateDocument(): Promise<{ valid: boolean; estado: string; observaciones?: string }> {
    await new Promise((r) => setTimeout(r, 100));
    return { valid: true, estado: "ACEPTADO" };
  }

  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: "Mock provider — always healthy" };
  }

  private generateMockContent(tipo: string, doc: SunatDocument): string {
    if (tipo === "PDF") return `%PDF-1.4 Mock PDF ${doc.serie}-${doc.numero}`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <ID>${doc.serie}-${doc.numero}</ID>
  <IssueDate>${doc.fechaEmision}</IssueDate>
  <AccountingSupplierParty><Party><PartyTaxScheme><CompanyID>${doc.rucEmisor}</CompanyID></PartyTaxScheme></Party></AccountingSupplierParty>
  <!-- Mock content — ControlSUNAT -->
</Invoice>`;
  }
}
