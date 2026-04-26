"use client";

import { useState, useEffect, useCallback } from "react";
import { useActiveCompany } from "./useActiveCompany";

export interface VoucherDocument {
  id: string;
  tipo: string;
  filename: string;
  filesize: number;
  mimeType: string;
  uploadedAt: string;
  downloadUrl: string | null;
}

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
  items?: Array<{
    descripcion: string;
    cantidad: number;
    unidad: string;
    precioUnitario: number;
    subtotal: number;
    igv: number;
    total: number;
  }>;
  documents?: VoucherDocument[];
}

export interface VoucherFilters {
  fechaInicio?: string;
  fechaFin?: string;
  search?: string;
  estado?: string;
  tipoDoc?: string; // FACTURA, BOLETA, etc.
  page?: number;
  limit?: number;
}

export interface VoucherPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function useVouchers(direccion?: "COMPRA" | "VENTA", initialFilters?: VoucherFilters) {
  const { activeCompany } = useActiveCompany();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<VoucherPagination | null>(null);
  const [filters, setFilters] = useState<VoucherFilters>(initialFilters ?? {});

  const fetchVouchers = useCallback(async (overrideFilters?: VoucherFilters) => {
    if (!activeCompany) return;
    setLoading(true);
    setError(null);

    const activeFilters = overrideFilters ?? filters;

    try {
      const params = new URLSearchParams({ companyId: activeCompany.id });
      if (direccion) params.set("tipo", direccion);
      if (activeFilters.fechaInicio) params.set("fechaInicio", activeFilters.fechaInicio);
      if (activeFilters.fechaFin) params.set("fechaFin", activeFilters.fechaFin);
      if (activeFilters.search) params.set("search", activeFilters.search);
      if (activeFilters.estado) params.set("estado", activeFilters.estado);
      if (activeFilters.tipoDoc) params.set("tipoDoc", activeFilters.tipoDoc);
      if (activeFilters.page) params.set("page", String(activeFilters.page));
      if (activeFilters.limit) params.set("limit", String(activeFilters.limit ?? 100));

      const response = await fetch(`/api/vouchers?${params}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Error al cargar comprobantes");
      setVouchers(data.data ?? []);
      if (data.pagination) setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar comprobantes");
    } finally {
      setLoading(false);
    }
  }, [activeCompany, direccion, filters]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!activeCompany) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      setVouchers([]);
      try {
        const params = new URLSearchParams({ companyId: activeCompany.id });
        if (direccion) params.set("tipo", direccion);
        if (filters.fechaInicio) params.set("fechaInicio", filters.fechaInicio);
        if (filters.fechaFin) params.set("fechaFin", filters.fechaFin);
        if (filters.search) params.set("search", filters.search);
        if (filters.estado) params.set("estado", filters.estado);
        if (filters.tipoDoc) params.set("tipoDoc", filters.tipoDoc);
        params.set("limit", String(filters.limit ?? 100));

        const response = await fetch(`/api/vouchers?${params}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.error || "Error al cargar comprobantes");
        if (!cancelled) {
          setVouchers(data.data ?? []);
          if (data.pagination) setPagination(data.pagination);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar comprobantes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [activeCompany, direccion, filters]);

  const updateFilters = useCallback((newFilters: Partial<VoucherFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  return {
    vouchers,
    loading,
    error,
    pagination,
    filters,
    updateFilters,
    clearFilters,
    refetch: fetchVouchers,
  };
}
