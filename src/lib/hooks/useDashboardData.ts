"use client";

import { useState, useEffect, useCallback } from "react";
import { useActiveCompany } from "./useActiveCompany";

export interface DashboardSummary {
  comprasMes: number;
  comprasMesAnterior: number;
  ventasMes: number;
  ventasMesAnterior: number;
  cuentasCobrar: number;
  cuentasPagar: number;
  documentosDescargados: number;
  xmlFaltantes: number;
  pdfFaltantes: number;
  cdrFaltantes: number;
  detracciones: number;
  detraccionesPendientes: number;
  impuestoProximo: number;
  diasParaImpuesto: number;
  topProveedores: Array<{ ruc: string; nombre: string; monto: number; facturas: number }>;
  recentVouchers: Array<{
    id: string;
    tipo: string;
    serie: string;
    numero: string;
    fechaEmision: string;
    razonSocialEmisor: string;
    rucEmisor: string;
    total: number;
    moneda: string;
    tieneXML: boolean;
    tienePDF: boolean;
    tieneCDR: boolean;
    estado: string;
  }>;
  recentAlertas: Array<{
    id: string;
    tipo: string;
    titulo: string;
    descripcion: string;
    leida: boolean;
    fecha: string;
  }>;
}

export interface ChartData {
  ventasCompras: Array<{ mes: string; ventas: number; compras: number }>;
  flujoCaja: Array<{ semana: string; ingresos: number; egresos: number; neto: number }>;
  documentos: Array<{ tipo: string; cantidad: number; porcentaje: number }>;
}

const EMPTY_CHARTS: ChartData = { ventasCompras: [], flujoCaja: [], documentos: [] };

async function fetchCharts(companyId: string): Promise<ChartData> {
  const res = await fetch(`/api/dashboard/charts?companyId=${companyId}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Error al cargar gráficos");
  const d = json.data ?? {};
  return {
    ventasCompras: Array.isArray(d.ventasCompras) ? d.ventasCompras : [],
    flujoCaja: Array.isArray(d.flujoCaja) ? d.flujoCaja : [],
    documentos: Array.isArray(d.documentos) ? d.documentos : [],
  };
}

async function fetchSummary(companyId: string): Promise<DashboardSummary> {
  const res = await fetch(`/api/dashboard/summary?companyId=${companyId}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Error al cargar resumen");
  const d = json.data ?? {};
  return {
    ...d,
    topProveedores: Array.isArray(d.topProveedores) ? d.topProveedores : [],
    recentVouchers: Array.isArray(d.recentVouchers) ? d.recentVouchers : [],
    recentAlertas: Array.isArray(d.recentAlertas) ? d.recentAlertas : [],
  };
}

export function useDashboardData() {
  const { activeCompany } = useActiveCompany();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [charts, setCharts] = useState<ChartData>(EMPTY_CHARTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    setError(null);
    setSummary(null);
    setCharts(EMPTY_CHARTS);
    try {
      const [summaryData, chartsData] = await Promise.all([
        fetchSummary(activeCompany.id),
        fetchCharts(activeCompany.id),
      ]);
      setSummary(summaryData);
      setCharts(chartsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos del dashboard");
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
      setSummary(null);
      setCharts(EMPTY_CHARTS);
      try {
        const [summaryData, chartsData] = await Promise.all([
          fetchSummary(activeCompany.id),
          fetchCharts(activeCompany.id),
        ]);
        if (!cancelled) { setSummary(summaryData); setCharts(chartsData); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar datos del dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [activeCompany]);

  return { summary, charts, loading, error, refetch: load };
}
