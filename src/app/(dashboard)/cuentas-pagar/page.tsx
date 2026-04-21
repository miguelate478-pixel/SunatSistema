"use client";

import React, { useState, useEffect } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useSession } from "@/lib/hooks/useSession";
import { AlertTriangle, CheckCircle2, FileDown, RefreshCw, Wallet } from "lucide-react";

interface AccountPayable {
  id: string;
  proveedor: string;
  ruc: string;
  documento: string;
  monto: number;
  saldo: number;
  moneda: string;
  fechaEmision: string;
  fechaVencimiento: string;
  diasVencimiento: number;
  estado: string;
}

export default function CuentasPagarPage() {
  const { session } = useSession();
  const [accounts, setAccounts] = useState<AccountPayable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const companyId = session?.companyRoles[0]?.companyId;
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/payable?companyId=${companyId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setAccounts(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar cuentas por pagar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const companyId = session?.companyRoles[0]?.companyId;
    const run = async () => {
      if (!companyId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/accounts/payable?companyId=${companyId}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        setAccounts(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar cuentas por pagar");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [session]);

  const total = accounts.reduce((s, c) => s + c.saldo, 0);
  const vencidas = accounts.filter(c => c.estado === "VENCIDO");
  const vigentes = accounts.filter(c => c.estado === "VIGENTE");

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Cuentas por Pagar" subtitle="Gestión de obligaciones con proveedores" />
        <div className="flex-1 overflow-auto p-6 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-32" />
              </div>
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Cuentas por Pagar" subtitle="Gestión de obligaciones con proveedores" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar datos</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={load}>Reintentar</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Cuentas por Pagar" subtitle="Gestión de obligaciones con proveedores" />
      <div className="flex-1 overflow-auto p-6 space-y-5">

        {vencidas.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-700 flex-1">
              <span className="font-semibold">{vencidas.length} facturas vencidas</span> por {formatCurrency(vencidas.reduce((s, c) => s + c.saldo, 0))}. Programa pagos urgentes.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium">Total por Pagar</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(total)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{accounts.length} facturas</p>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm">
            <p className="text-xs text-emerald-700 font-medium">Vigentes</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">{vigentes.length}</p>
            {accounts.length > 0 && <Progress value={(vigentes.length / accounts.length) * 100} className="mt-2 h-1.5" />}
          </div>
          <div className="bg-red-50 rounded-xl border border-red-200 p-4 shadow-sm">
            <p className="text-xs text-red-700 font-medium">Vencidas</p>
            <p className="text-xl font-bold text-red-600 mt-1">{vencidas.length}</p>
            <p className="text-xs text-red-600 mt-0.5">{formatCurrency(vencidas.reduce((s, c) => s + c.saldo, 0))}</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-0 px-6 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Facturas por Pagar
                <span className="ml-2 text-sm font-normal text-gray-500">({accounts.length} registros)</span>
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={load}>
                  <RefreshCw className="w-3.5 h-3.5" />Actualizar
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <FileDown className="w-3.5 h-3.5" />Exportar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-y border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Documento</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Emisión</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Vencimiento</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Días</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Saldo</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {accounts.map((cuenta) => (
                    <tr key={cuenta.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <p className="text-xs font-medium text-gray-900 max-w-[180px] truncate">{cuenta.proveedor}</p>
                        <p className="text-xs text-gray-400">{cuenta.ruc}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-xs font-mono font-semibold text-gray-900">{cuenta.documento}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600">{formatDate(cuenta.fechaEmision)}</td>
                      <td className="py-3 px-4 text-xs text-gray-600">{formatDate(cuenta.fechaVencimiento)}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={cuenta.diasVencimiento < 0 ? "destructive" : "secondary"} className="text-xs">
                          {cuenta.diasVencimiento > 0 ? `+${cuenta.diasVencimiento}` : cuenta.diasVencimiento}d
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-xs font-bold text-gray-900">{formatCurrency(cuenta.saldo)}</span>
                        {cuenta.moneda === "USD" && <span className="text-xs text-gray-400 ml-1">USD</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={cuenta.estado === "VENCIDO" ? "destructive" : "success"}>
                          {cuenta.estado === "VENCIDO" ? <AlertTriangle className="w-3 h-3 mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {cuenta.estado}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button variant="outline" size="sm">Pagar</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {accounts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Wallet className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No hay cuentas por pagar</p>
                  <p className="text-xs mt-1">Las cuentas aparecerán cuando se registren facturas de compra</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
