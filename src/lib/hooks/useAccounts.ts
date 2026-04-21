"use client";

import { useState, useEffect, useCallback } from "react";
import { useActiveCompany } from "./useActiveCompany";

export interface AccountReceivable {
  id: string;
  customerId: string;
  customerName: string;
  customerRuc: string;
  voucherId: string;
  serie: string;
  numero: string;
  fechaEmision: string;
  fechaVencimiento: string;
  montoTotal: number;
  montoPagado: number;
  montoPendiente: number;
  estado: "PENDIENTE" | "VENCIDO" | "PAGADO" | "PARCIAL";
  diasVencidos: number;
  moneda: string;
}

export interface AccountPayable {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierRuc: string;
  voucherId: string;
  serie: string;
  numero: string;
  fechaEmision: string;
  fechaVencimiento: string;
  montoTotal: number;
  montoPagado: number;
  montoPendiente: number;
  estado: "PENDIENTE" | "VENCIDO" | "PAGADO" | "PARCIAL";
  diasVencidos: number;
  moneda: string;
}

export function useAccountsReceivable() {
  const { activeCompany } = useActiveCompany();
  const [accounts, setAccounts] = useState<AccountReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    setError(null);
    setAccounts([]);
    try {
      const response = await fetch(`/api/accounts/receivable?companyId=${activeCompany.id}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Error al cargar cuentas por cobrar");
      setAccounts(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar cuentas por cobrar");
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
      setAccounts([]);
      try {
        const response = await fetch(`/api/accounts/receivable?companyId=${activeCompany.id}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.error || "Error al cargar cuentas por cobrar");
        if (!cancelled) setAccounts(data.data ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar cuentas por cobrar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [activeCompany]);

  return { accounts, loading, error, refetch: fetchAccounts };
}

export function useAccountsPayable() {
  const { activeCompany } = useActiveCompany();
  const [accounts, setAccounts] = useState<AccountPayable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    setError(null);
    setAccounts([]);
    try {
      const response = await fetch(`/api/accounts/payable?companyId=${activeCompany.id}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Error al cargar cuentas por pagar");
      setAccounts(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar cuentas por pagar");
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
      setAccounts([]);
      try {
        const response = await fetch(`/api/accounts/payable?companyId=${activeCompany.id}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.error || "Error al cargar cuentas por pagar");
        if (!cancelled) setAccounts(data.data ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar cuentas por pagar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [activeCompany]);

  return { accounts, loading, error, refetch: fetchAccounts };
}
