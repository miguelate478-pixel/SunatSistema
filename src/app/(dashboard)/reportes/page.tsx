"use client";

import React, { useState, useEffect } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/hooks/useSession";
import {
  BarChart3, FileText, Download, TrendingUp,
  ShoppingCart, Percent, AlertTriangle, CreditCard, Wallet,
  FileBarChart, Loader2, CheckCircle2, XCircle, Clock,
} from "lucide-react";

type ReportTipo = "compras" | "ventas" | "detracciones" | "alertas" | "cuentas_cobrar" | "cuentas_pagar" | "flujo_caja" | "resumen_ejecutivo";

interface ReportExecution {
  id: string;
  tipo: string;
  formato: string;
  estado: string;
  filesize: number | null;
  executedAt: string;
  completedAt: string | null;
  errorMsg: string | null;
}

const REPORT_CATALOG = [
  { id: "compras" as ReportTipo, title: "Registro de Compras", description: "Compras del período con IGV, totales y estado de archivos", icon: ShoppingCart, color: "text-emerald-600 bg-emerald-50" },
  { id: "ventas" as ReportTipo, title: "Registro de Ventas", description: "Ventas con débito fiscal y análisis por cliente", icon: TrendingUp, color: "text-blue-600 bg-blue-50" },
  { id: "detracciones" as ReportTipo, title: "Control de Detracciones", description: "Comprobantes afectos a detracción con estado de pago", icon: Percent, color: "text-amber-600 bg-amber-50" },
  { id: "alertas" as ReportTipo, title: "Reporte de Alertas", description: "Alertas del sistema por tipo y categoría", icon: AlertTriangle, color: "text-red-600 bg-red-50" },
  { id: "cuentas_cobrar" as ReportTipo, title: "Cuentas por Cobrar", description: "Cartera de clientes con antigüedad y estado", icon: CreditCard, color: "text-cyan-600 bg-cyan-50" },
  { id: "cuentas_pagar" as ReportTipo, title: "Cuentas por Pagar", description: "Obligaciones con proveedores y cronograma", icon: Wallet, color: "text-orange-600 bg-orange-50" },
  { id: "flujo_caja" as ReportTipo, title: "Flujo de Caja", description: "Ingresos vs egresos por mes — últimos 6 meses", icon: BarChart3, color: "text-indigo-600 bg-indigo-50" },
  { id: "resumen_ejecutivo" as ReportTipo, title: "Resumen Ejecutivo", description: "KPIs principales del período actual", icon: FileBarChart, color: "text-gray-600 bg-gray-50" },
];

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function downloadContent(content: string, filename: string, formato: string) {
  const mime = formato === "CSV" ? "text/csv" : "application/json";
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportesPage() {
  const { session } = useSession();
  const [history, setHistory] = useState<ReportExecution[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [formato, setFormato] = useState<"JSON" | "CSV">("CSV");

  const companyId = session?.companyRoles[0]?.companyId;

  useEffect(() => {
    const run = async () => {
      if (!companyId) return;
      setHistoryLoading(true);
      try {
        const res = await fetch(`/api/reports?companyId=${companyId}`);
        const json = await res.json();
        if (json.success) setHistory(json.data);
      } catch { /* silent */ } finally {
        setHistoryLoading(false);
      }
    };
    run();
  }, [companyId]);

  async function handleGenerate(tipo: ReportTipo) {
    if (!companyId || generating) return;
    setGenerating(tipo);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, tipo, formato }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      // Auto-download
      const ext = formato === "CSV" ? "csv" : "json";
      downloadContent(json.data.content, `${tipo}_${new Date().toISOString().split("T")[0]}.${ext}`, formato);

      // Refresh history
      const histRes = await fetch(`/api/reports?companyId=${companyId}`);
      const histJson = await histRes.json();
      if (histJson.success) setHistory(histJson.data);
    } catch (err) {
      console.error("Report error:", err);
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Reportes" subtitle="Generación de reportes con datos reales" />

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Format selector */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-blue-900">Reportes con datos reales</h4>
                  <p className="text-xs text-blue-700 mt-0.5">Los reportes se generan desde la base de datos y se descargan automáticamente.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-700 font-medium">Formato:</span>
                <div className="flex rounded-lg border border-blue-300 overflow-hidden">
                  {(["CSV", "JSON"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormato(f)}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors ${formato === f ? "bg-blue-600 text-white" : "bg-white text-blue-700 hover:bg-blue-50"}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {REPORT_CATALOG.map((reporte) => {
            const Icon = reporte.icon;
            const isGenerating = generating === reporte.id;
            return (
              <Card key={reporte.id} className="hover:shadow-lg transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${reporte.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm leading-tight">{reporte.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <CardDescription className="text-xs leading-relaxed">{reporte.description}</CardDescription>
                  <Button
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => handleGenerate(reporte.id)}
                    disabled={!!generating || !companyId}
                  >
                    {isGenerating ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generando...</>
                    ) : (
                      <><Download className="w-3.5 h-3.5" />Generar {formato}</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* History */}
        <Card>
          <CardHeader className="pb-0 px-6 pt-4">
            <CardTitle className="text-base">Historial de Reportes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {historyLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <BarChart3 className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">Sin reportes generados</p>
                <p className="text-xs mt-1">Genera tu primer reporte arriba</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-y border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Formato</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Tamaño</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-xs font-medium text-gray-900">{r.tipo.replace("_", " ").toUpperCase()}</td>
                        <td className="py-3 px-4"><Badge variant="outline" className="text-xs">{r.formato}</Badge></td>
                        <td className="py-3 px-4 text-xs text-gray-600">{new Date(r.executedAt).toLocaleString("es-PE")}</td>
                        <td className="py-3 px-4 text-right text-xs text-gray-600">{formatBytes(r.filesize)}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={r.estado === "COMPLETED" ? "success" : r.estado === "FAILED" ? "destructive" : "secondary"}>
                            {r.estado === "COMPLETED" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {r.estado === "FAILED" && <XCircle className="w-3 h-3 mr-1" />}
                            {r.estado === "PROCESSING" && <Clock className="w-3 h-3 mr-1" />}
                            {r.estado}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
