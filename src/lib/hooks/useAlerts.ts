"use client";

import { useState, useEffect, useCallback } from "react";
import { useActiveCompany } from "./useActiveCompany";

export interface Alert {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: "ERROR" | "WARNING" | "INFO" | "SUCCESS";
  categoria: string;
  accion?: string | null;
  leida: boolean;
  fechaCreacion: string;
  voucherId?: string | null;
  companyId: string;
}

export function useAlerts() {
  const { activeCompany } = useActiveCompany();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    setError(null);
    setAlerts([]);
    try {
      const response = await fetch(`/api/alerts?companyId=${activeCompany.id}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Error al cargar alertas");
      setAlerts(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar alertas");
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
      setAlerts([]);
      try {
        const response = await fetch(`/api/alerts?companyId=${activeCompany.id}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.error || "Error al cargar alertas");
        if (!cancelled) setAlerts(data.data ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar alertas");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [activeCompany]);

  const markAsRead = useCallback(async (alertId: string) => {
    const response = await fetch(`/api/alerts/${alertId}/read`, { method: "PATCH" });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || "Error al marcar alerta como leída");
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, leida: true } : a)));
    return data;
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!activeCompany) return;
    const response = await fetch(`/api/alerts/mark-all-read?companyId=${activeCompany.id}`, { method: "PATCH" });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || "Error al marcar todas las alertas como leídas");
    setAlerts((prev) => prev.map((a) => ({ ...a, leida: true })));
    return data;
  }, [activeCompany]);

  return { alerts, loading, error, refetch: fetchAlerts, markAsRead, markAllAsRead };
}
