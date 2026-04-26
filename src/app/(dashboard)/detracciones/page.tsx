"use client";

import React, { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useDetracciones } from "@/lib/hooks/useDetracciones";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Percent, AlertTriangle, CheckCircle2, Clock, Download, FileDown, RefreshCw } from "lucide-react";

function DetraccionesSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="Detracciones" subtitle="Control de detracciones SPOT" />
      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        {/* Table */}
        <Card>
          <CardHeader className="pb-0 px-6 pt-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-9 w-32" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16 ml-auto" />
                    <Skeleton className="h-6 w-12" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DetraccionesPage() {
  const { detracciones, loading, error, refetch, payDetraction } = useDetracciones();
  const [payingId, setPayingId] = useState<string | null>(null);

  const totalDetracciones = detracciones.reduce((sum, d) => sum + d.monto, 0);
  const pagadas = detracciones.filter(d => d.estado === "PAGADO").length;
  const pendientes = detracciones.filter(d => d.estado === "PENDIENTE").length;
  const vencidas = detracciones.filter(d => d.estado === "VENCIDO").length;

  async function handlePay(detractionId: string) {
    try {
      setPayingId(detractionId);
      await payDetraction(detractionId);
    } catch (err) {
      console.error("Error al pagar detracción:", err);
    } finally {
      setPayingId(null);
    }
  }

  if (loading) {
    return <DetraccionesSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Detracciones" subtitle="Control de detracciones SPOT" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar datos</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => refetch()}>Reintentar</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Detracciones" subtitle="Control de detracciones SPOT" />

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Alert banner */}
        {pendientes > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700 flex-1">
              <span className="font-semibold">{pendientes} detracciones pendientes</span> de pago. Revisa los vencimientos para evitar sanciones.
            </p>
            <Button variant="warning" size="sm">Ver pendientes</Button>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium">Total Detracciones</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalDetracciones)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{detracciones.length} comprobantes</p>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm">
            <p className="text-xs text-emerald-700 font-medium">Pagadas</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">{pagadas}</p>
            <Progress value={detracciones.length > 0 ? (pagadas / detracciones.length) * 100 : 0} className="mt-2 h-1.5" />
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 shadow-sm">
            <p className="text-xs text-amber-700 font-medium">Pendientes</p>
            <p className="text-xl font-bold text-amber-600 mt-1">{pendientes}</p>
            <p className="text-xs text-amber-600 mt-0.5">Requieren atención</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-200 p-4 shadow-sm">
            <p className="text-xs text-red-700 font-medium">Vencidas</p>
            <p className="text-xl font-bold text-red-600 mt-1">{vencidas}</p>
            <p className="text-xs text-red-600 mt-0.5">Acción inmediata</p>
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-0 px-6 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Registro de Detracciones
                <span className="ml-2 text-sm font-normal text-gray-500">({detracciones.length} registros)</span>
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualizar
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <FileDown className="w-3.5 h-3.5" />
                  Exportar Reporte
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-y border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Comprobante</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Empresa</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Doc.</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">%</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Monto Detrac.</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Neto a Pagar</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detracciones.map((det) => {
                    const netoPagar = det.total - det.monto;
                    const isCompra = det.tipo === "COMPRA";
                    
                    return (
                      <tr key={det.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-mono font-semibold text-gray-900">
                              {det.serie}-{det.numero}
                            </p>
                            <Badge variant={isCompra ? "secondary" : "info"} className="text-xs">
                              {isCompra ? "COMPRA" : "VENTA"}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-xs font-medium text-gray-900 max-w-[180px] truncate">
                            {det.razonSocialEmisor}
                          </p>
                          <p className="text-xs text-gray-400">
                            {det.rucEmisor}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600 whitespace-nowrap">
                          {formatDate(det.fechaEmision)}
                        </td>
                        <td className="py-3 px-4 text-right text-xs font-semibold text-gray-900">
                          {formatCurrency(det.total)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="outline" className="text-xs font-bold">
                            {det.porcentaje}%
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right text-xs font-bold text-amber-600">
                          {formatCurrency(det.monto)}
                        </td>
                        <td className="py-3 px-4 text-right text-xs font-semibold text-gray-900">
                          {formatCurrency(netoPagar)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={
                            det.estado === "PAGADO" ? "success" :
                            det.estado === "VENCIDO" ? "destructive" : "warning"
                          }>
                            {det.estado === "PAGADO" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {det.estado === "PENDIENTE" && <Clock className="w-3 h-3 mr-1" />}
                            {det.estado === "VENCIDO" && <AlertTriangle className="w-3 h-3 mr-1" />}
                            {det.estado}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {det.estado === "PENDIENTE" && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Marcar como pagada"
                                onClick={() => handlePay(det.id)}
                                disabled={payingId === det.id}
                              >
                                {payingId === det.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            )}
                            <Button variant="ghost" size="icon-sm" title="Descargar ZIP">
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {detracciones.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Percent className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No se encontraron detracciones</p>
                  <p className="text-xs mt-1">No hay comprobantes afectos a detracción</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Info card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                <Percent className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">Sistema de Detracciones SPOT</h4>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Las detracciones son montos que el cliente o proveedor debe depositar en el Banco de la Nación antes del pago. 
                  Los porcentajes varían según el tipo de bien o servicio (4%, 10%, 12%, 15%). 
                  El incumplimiento puede generar multas y sanciones de SUNAT.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
