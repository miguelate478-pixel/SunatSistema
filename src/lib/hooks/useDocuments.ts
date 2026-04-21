"use client";

import { useState, useEffect, useCallback } from "react";
import { useActiveCompany } from "./useActiveCompany";

export interface Document {
  id: string;
  voucherId: string;
  serie: string;
  numero: string;
  tipo: string;
  razonSocialEmisor: string;
  rucEmisor: string;
  fechaEmision: string;
  total: number;
  moneda: string;
  tieneXML: boolean;
  tienePDF: boolean;
  tieneCDR: boolean;
  estado: string;
  folderPath: string;
  lastAccessed?: string;
  downloadCount: number;
}

export function useDocuments() {
  const { activeCompany } = useActiveCompany();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    setError(null);
    setDocuments([]);
    try {
      const response = await fetch(`/api/documents?companyId=${activeCompany.id}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Error al cargar documentos");
      setDocuments(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar documentos");
    } finally {
      setLoading(false);
    }
  }, [activeCompany]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!activeCompany) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      setDocuments([]);
      try {
        const response = await fetch(`/api/documents?companyId=${activeCompany.id}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.error || "Error al cargar documentos");
        if (!cancelled) setDocuments(data.data ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar documentos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [activeCompany]);

  const downloadDocument = useCallback(async (documentId: string, fileType: "XML" | "PDF" | "CDR") => {
    const response = await fetch(`/api/documents/${documentId}/download?type=${fileType}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || "Error al descargar documento");
    await fetchDocuments();
    return data;
  }, [fetchDocuments]);

  return { documents, loading, error, refetch: fetchDocuments, downloadDocument };
}
