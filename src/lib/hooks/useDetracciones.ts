"use client";

import { useState, useEffect, useCallback } from "react";
import { useActiveCompany } from "./useActiveCompany";

export interface Detraction {
  id: string;
  voucherId: string;
  serie: string;
  numero: string;
  tipo: string;
  razonSocialEmisor: string;
  rucEmisor: string;
  fechaEmision: string;
  total: number;
  porcentaje: number;
  monto: number;
  estado: string;
  fechaVencimiento?: string | null;
  fechaPago?: string | null;
  numeroConstancia?: string | null;
  voucher?: { tieneXML: boolean; tienePDF: boolean; tieneCDR: boolean; estado: string };
}

export function useDetracciones() {
  const { activeCompany } = useActiveCompany();
  const [detracciones, setDetracciones] = useState<Detraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetracciones = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    setError(null);
    setDetracciones([]);
    try {
      const response = await fetch(`/api/detracciones?companyId=${activeCompany.id}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Error al cargar detracciones");
      setDetracciones(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar detracciones");
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
      setDetracciones([]);
      try {
        const response = await fetch(`/api/detracciones?companyId=${activeCompany.id}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.error || "Error al cargar detracciones");
        if (!cancelled) setDetracciones(data.data ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar detracciones");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [activeCompany]);

  const payDetraction = useCallback(async (detractionId: string) => {
    const response = await fetch(`/api/detracciones/${detractionId}/pay`, { method: "PATCH" });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || "Error al pagar detracción");
    await fetchDetracciones();
    return data;
  }, [fetchDetracciones]);

  return { detracciones, loading, error, refetch: fetchDetracciones, payDetraction };
}
