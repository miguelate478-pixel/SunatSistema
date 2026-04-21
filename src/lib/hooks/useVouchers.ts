"use client";

import { useState, useEffect, useCallback } from "react";
import { useActiveCompany } from "./useActiveCompany";

export interface Voucher {
  id: string;
  serie: string;
  numero: string;
  tipo: string;
  razonSocialEmisor: string;
  rucEmisor: string;
  razonSocialReceptor: string;
  rucReceptor: string;
  fechaEmision: string;
  fechaVencimiento?: string;
  subtotal: number;
  igv: number;
  total: number;
  moneda: string;
  tieneXML: boolean;
  tienePDF: boolean;
  tieneCDR: boolean;
  estado: string;
  afectoDetraccion: boolean;
  porcentajeDetraccion?: number;
  montoDetraccion?: number;
  estadoDetraccion?: string;
  observaciones?: string;
  detraccion?: { porcentaje: number; monto: number; estado: string };
}

export function useVouchers(tipo?: "COMPRA" | "VENTA") {
  const { activeCompany } = useActiveCompany();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVouchers = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    setError(null);
    setVouchers([]);
    try {
      let url = `/api/vouchers?companyId=${activeCompany.id}`;
      if (tipo) url += `&tipo=${tipo}`;
      const response = await fetch(url);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Error al cargar comprobantes");
      setVouchers(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar comprobantes");
    } finally {
      setLoading(false);
    }
  }, [activeCompany, tipo]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!activeCompany) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      setVouchers([]);
      try {
        let url = `/api/vouchers?companyId=${activeCompany.id}`;
        if (tipo) url += `&tipo=${tipo}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!data.success) throw new Error(data.error || "Error al cargar comprobantes");
        if (!cancelled) setVouchers(data.data ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar comprobantes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [activeCompany, tipo]);

  return { vouchers, loading, error, refetch: fetchVouchers };
}
