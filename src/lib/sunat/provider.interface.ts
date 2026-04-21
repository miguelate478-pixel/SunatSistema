/**
 * SUNAT Provider Interface
 *
 * Defines the contract for any SUNAT/OSE integration.
 * Implementations:
 *   - MockSunatProvider  → current (simulated)
 *   - RealSunatProvider  → future (OAuth + SUNAT API)
 *
 * To add a real provider:
 *   1. Implement ISunatProvider
 *   2. Set SUNAT_PROVIDER=real in env
 *   3. Configure SUNAT_CLIENT_ID, SUNAT_CLIENT_SECRET, SUNAT_RUC
 */

export interface SunatDocument {
  voucherId: string;
  serie: string;
  numero: string;
  tipo: string;
  rucEmisor: string;
  fechaEmision: string;
}

export interface DownloadResult {
  voucherId: string;
  tipo: "XML" | "PDF" | "CDR";
  content: Buffer;
  filename: string;
  mimeType: string;
  success: boolean;
  error?: string;
}

export interface SunatQueryParams {
  ruc: string;
  fechaInicio?: string;
  fechaFin?: string;
  serie?: string;
  numero?: string;
}

export interface ISunatProvider {
  /** Download a specific document file */
  downloadDocument(doc: SunatDocument, tipo: "XML" | "PDF" | "CDR"): Promise<DownloadResult>;

  /** Query available documents from SUNAT */
  queryDocuments(params: SunatQueryParams): Promise<SunatDocument[]>;

  /** Validate a document against SUNAT */
  validateDocument(doc: SunatDocument): Promise<{ valid: boolean; estado: string; observaciones?: string }>;

  /** Health check — verify credentials are valid */
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}
