"use client";

import React from "react";
import { Topbar } from "@/components/layout/topbar";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { VentasComprasChart, FlujoCajaChart, DocumentosChart } from "@/components/dashboard/charts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardData } from "@/lib/hooks/useDashboardData";
import { useActiveCompany } from "@/lib/hooks/useActiveCompany";
import { OnboardingBanner } from "@/components/onboarding/onboarding-banner";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ShoppingCart,
  TrendingUp,
  FileText,
  AlertTriangle,
  Percent,
  Calendar,
  CreditCard,
  Wallet,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

function calcChange(current: number, previous: number) {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Dashboard"
        subtitle="Resumen ejecutivo · Cargando..."
      />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* KPI Grid - Row 1 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        {/* KPI Grid - Row 2 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="lg:col-span-2 h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        {/* Recent documents */}
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { summary, charts, loading, error } = useDashboardData();
  const { activeCompany } = useActiveCompany();

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Dashboard" subtitle="Resumen ejecutivo" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar datos</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Reintentar</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Dashboard" subtitle="Resumen ejecutivo" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay datos disponibles</h3>
            <p className="text-gray-600 mb-4">No se encontraron datos para mostrar en el dashboard.</p>
          </div>
        </div>
      </div>
    );
  }

  const comprasChange = calcChange(summary.comprasMes, summary.comprasMesAnterior);
  const ventasChange = calcChange(summary.ventasMes, summary.ventasMesAnterior);
  const totalDocsFaltantes = summary.xmlFaltantes + summary.pdfFaltantes + summary.cdrFaltantes;

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Dashboard"
        subtitle={`Resumen ejecutivo · ${new Date().toLocaleDateString("es-PE", { month: "long", year: "numeric" })}`}
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">

        {/* Critical alerts banner */}
        {totalDocsFaltantes > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-700 flex-1">
              <span className="font-semibold">{totalDocsFaltantes} documentos faltantes</span> requieren atención inmediata.
            </p>
            <Link href="/documentos">
              <Button variant="destructive" size="sm">Ver documentos</Button>
            </Link>
          </div>
        )}

        {/* Onboarding banner — shown when no vouchers yet */}
        {summary.documentosDescargados === 0 && (
          <OnboardingBanner
            hasCredentials={!!activeCompany}
            credentialsOk={false}
            hasVouchers={false}
          />
        )}

        {/* KPI Grid - Row 1 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            title="Compras del Mes"
            value={formatCurrency(summary.comprasMes)}
            change={comprasChange}
            changeLabel="vs mes anterior"
            icon={ShoppingCart}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
            trend={comprasChange > 0 ? "up" : "down"}
            trendPositive={false}
          />
          <KpiCard
            title="Ventas del Mes"
            value={formatCurrency(summary.ventasMes)}
            change={ventasChange}
            changeLabel="vs mes anterior"
            icon={TrendingUp}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
            trend={ventasChange > 0 ? "up" : "down"}
            trendPositive={true}
          />
          <KpiCard
            title="Cuentas x Cobrar"
            value={formatCurrency(summary.cuentasCobrar)}
            subtitle="Ver detalle"
            icon={CreditCard}
            iconColor="text-violet-600"
            iconBg="bg-violet-50"
            alert={summary.cuentasCobrar > 0}
            alertLevel="warning"
          />
          <KpiCard
            title="Cuentas x Pagar"
            value={formatCurrency(summary.cuentasPagar)}
            subtitle="Ver detalle"
            icon={Wallet}
            iconColor="text-orange-600"
            iconBg="bg-orange-50"
            alert={summary.cuentasPagar > 0}
            alertLevel="warning"
          />
        </div>

        {/* KPI Grid - Row 2 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            title="Docs Descargados"
            value={summary.documentosDescargados.toString()}
            subtitle="Este mes"
            icon={FileText}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
          />
          <KpiCard
            title="Docs Faltantes"
            value={totalDocsFaltantes.toString()}
            subtitle={`XML: ${summary.xmlFaltantes} · PDF: ${summary.pdfFaltantes} · CDR: ${summary.cdrFaltantes}`}
            icon={AlertTriangle}
            iconColor="text-red-600"
            iconBg="bg-red-50"
            alert={totalDocsFaltantes > 0}
            alertLevel="error"
          />
          <KpiCard
            title="Detracciones Pend."
            value={summary.detraccionesPendientes.toString()}
            subtitle={`de ${summary.detracciones} totales`}
            icon={Percent}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
            alert={summary.detraccionesPendientes > 0}
            alertLevel="warning"
          />
          <KpiCard
            title="Próximo Impuesto"
            value={formatCurrency(summary.impuestoProximo)}
            subtitle={`Vence en ${summary.diasParaImpuesto} días`}
            icon={Calendar}
            iconColor="text-red-600"
            iconBg="bg-red-50"
            alert={summary.diasParaImpuesto <= 7}
            alertLevel="warning"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Ventas vs Compras */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Ventas vs Compras</CardTitle>
                  <CardDescription>Últimos 7 meses</CardDescription>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                    Ventas
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    Compras
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <VentasComprasChart data={charts.ventasCompras} />
            </CardContent>
          </Card>

          {/* Distribución documentos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tipos de Documentos</CardTitle>
              <CardDescription>Distribución del mes</CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentosChart data={charts.documentos} />
              <div className="mt-2 space-y-1.5">
                {charts.documentos.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">Sin documentos registrados</p>
                ) : (
                  charts.documentos.map((item) => (
                    <div key={item.tipo} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                          item.tipo === "FACTURA" ? "bg-blue-600" :
                          item.tipo === "BOLETA" ? "bg-emerald-500" :
                          item.tipo === "NOTA_CREDITO" ? "bg-amber-500" :
                          "bg-red-500"
                        }`} />
                        <span className="text-gray-600">{item.tipo}</span>
                      </div>
                      <span className="font-medium text-gray-900">{item.cantidad}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Flujo de caja */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Flujo de Caja</CardTitle>
                  <CardDescription>Por semana - Abril 2024</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <FlujoCajaChart data={charts.flujoCaja} />
            </CardContent>
          </Card>

          {/* Top Proveedores */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Top Proveedores</CardTitle>
                <Link href="/compras">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                    Ver todos <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.topProveedores.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Sin compras registradas</p>
              ) : (
                summary.topProveedores.map((prov, i) => (
                  <div key={prov.ruc} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{prov.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Progress value={(prov.monto / (summary.topProveedores[0]?.monto || 1)) * 100} className="h-1 flex-1" />
                        <span className="text-xs text-gray-500 shrink-0">{formatCurrency(prov.monto)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Alertas recientes */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Alertas Recientes</CardTitle>
                <Link href="/alertas">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                    Ver todas <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {summary.recentAlertas.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Sin alertas recientes</p>
              ) : (
                summary.recentAlertas.map((alerta) => (
                  <div key={alerta.id} className="flex items-start gap-2.5 py-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      alerta.tipo === "ERROR" ? "bg-red-500" :
                      alerta.tipo === "WARNING" ? "bg-amber-500" :
                      alerta.tipo === "SUCCESS" ? "bg-emerald-500" : "bg-blue-500"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{alerta.titulo}</p>
                      <p className="text-xs text-gray-500 truncate">{alerta.descripcion}</p>
                    </div>
                    {!alerta.leida && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent documents */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Últimos Comprobantes</CardTitle>
                <CardDescription>Compras recientes del período</CardDescription>
              </div>
              <Link href="/compras">
                <Button variant="outline" size="sm" className="gap-1.5">
                  Ver módulo completo <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Comprobante</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Proveedor</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Archivos</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {summary.recentVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-xs text-gray-400">
                        Sin comprobantes registrados
                      </td>
                    </tr>
                  ) : (
                    summary.recentVouchers.map((comp) => (
                      <tr key={comp.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-medium text-gray-900">
                              {comp.serie}-{comp.numero}
                            </span>
                            <Badge variant={
                              comp.tipo === "FACTURA" ? "info" :
                              comp.tipo === "NOTA_CREDITO" ? "warning" : "secondary"
                            } className="text-xs">
                              {comp.tipo === "FACTURA" ? "FAC" :
                               comp.tipo === "NOTA_CREDITO" ? "NC" :
                               comp.tipo === "BOLETA" ? "BOL" : comp.tipo}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="text-xs font-medium text-gray-900 truncate max-w-[180px]">{comp.razonSocialEmisor}</p>
                          <p className="text-xs text-gray-400">{comp.rucEmisor}</p>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-600">{formatDate(comp.fechaEmision)}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="text-xs font-semibold text-gray-900">{formatCurrency(comp.total)}</span>
                          {comp.moneda === "USD" && <span className="text-xs text-gray-400 ml-1">USD</span>}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-center gap-1">
                            <span className={`text-xs font-mono px-1 rounded ${comp.tieneXML ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>XML</span>
                            <span className={`text-xs font-mono px-1 rounded ${comp.tienePDF ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>PDF</span>
                            <span className={`text-xs font-mono px-1 rounded ${comp.tieneCDR ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>CDR</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge variant={
                            comp.estado === "ACEPTADO" ? "success" :
                            comp.estado === "RECHAZADO" ? "destructive" :
                            comp.estado === "OBSERVADO" ? "warning" :
                            comp.estado === "PENDIENTE" ? "secondary" : "outline"
                          }>
                            {comp.estado}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}