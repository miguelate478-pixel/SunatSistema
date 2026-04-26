"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveCompany } from "@/lib/hooks/useActiveCompany";
import {
  Download, RefreshCw, CheckCircle2, XCircle, Clock,
  Loader2, FileCode, FileText, FileDown, Package,
  AlertTriangle, Settings, Search,
} from "lucide-react";
import Link from "next/link";

interface DownloadJob {
  id: string;
  tipo: string;
  parametros: Record<string, string>;
  estado: string;
  progreso: number;
  totalDocs: number;
  docsOk: number;
  docsError: number;
  errorMsg: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface SunatCredStatus {
  isActive: boolean;
  lastTestOk: boolean | null;
  ruc: string;
}

interface SyncResult {
  docsNuevos: number;
  estado: string;
  errorMsg?: string;
}

const TIPO_CONFIG = {
  XML:    { icon: FileCode,  label: "Archivos XML",              color: "text-emerald-600 bg-emerald-50" },
  PDF:    { icon: FileText,  label: "Archivos PDF",              color: "text-blue-600 bg-blue-50" },
  CDR:    { icon: FileDown,  label: "Archivos CDR",              color: "text-violet-600 bg-violet-50" },
  MASIVO: { icon: Package,   label: "Descarga Masiva (XML+PDF+CDR)", color: "text-amber-600 bg-amber-50" },
};

function getMonths(n = 6) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const label = d.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
    const start = d.toISOString().split("T")[0];
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
    return { label: label.charAt(0).toUpperCase() + label.slice(1), start, end };
  });
}

export default function DescargasPage() {
  const { activeCompany } = useActiveCompany();
  const companyId = activeCompany?.id;

  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [credStatus, setCredStatus] = useState<SunatCredStatus | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(0);
  const months = getMonths(6);

  const loadJobs = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await fetch(`/api/download-jobs?companyId=${companyId}`);
      const json = await res.json();
      if (json.success) setJobs(json.data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    const run = async () => {
      if (!companyId) return;
      try {
        const res = await fetch(`/api/sunat/credentials?companyId=${companyId}`);
        const json = await res.json();
        if (json.success && json.data) setCredStatus(json.data);
      } catch { /* silent */ }
    };
    run();
  }, [companyId]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // Poll active jobs every 2s
  useEffect(() => {
    const hasActive = jobs.some((j) => j.estado === "PENDING" || j.estado === "PROCESSING");
    if (!hasActive) return;
    const interval = setInterval(loadJobs, 2000);
    return () => clearInterval(interval);
  }, [jobs, loadJobs]);

  // Step 1: Sync — discover new vouchers from SUNAT
  async function handleSync() {
    if (!companyId || syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const period = months[selectedPeriod];
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          fechaInicio: period.start,
          fechaFin: period.end,
          downloadFiles: false, // only discover, user will trigger download manually
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSyncResult(json.data);
        await loadJobs();
      } else {
        setSyncResult({ docsNuevos: 0, estado: "FAILED", errorMsg: json.error });
      }
    } catch {
      setSyncResult({ docsNuevos: 0, estado: "FAILED", errorMsg: "Error de conexión" });
    } finally {
      setSyncing(false);
    }
  }

  // Step 2: Download files for existing vouchers
  async function handleCreate(tipo: "XML" | "PDF" | "CDR" | "MASIVO") {
    if (!companyId || creating) return;
    setCreating(tipo);
    try {
      const period = months[selectedPeriod];
      const res = await fetch("/api/download-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          tipo,
          parametros: { fechaInicio: period.start, fechaFin: period.end },
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await loadJobs();
    } catch (err) {
      console.error("Create job error:", err);
    } finally {
      setCreating(null);
    }
  }

  const activeJobs = jobs.filter((j) => j.estado === "PENDING" || j.estado === "PROCESSING");
  const completedJobs = jobs.filter((j) => j.estado === "COMPLETED");
  const failedJobs = jobs.filter((j) => j.estado === "FAILED");
  const isConnected = credStatus?.lastTestOk === true;
  const hasCredentials = !!credStatus;

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Descargas SUNAT" subtitle="Descarga de comprobantes electrónicos" />

      <div className="flex-1 overflow-auto p-6 space-y-5">

        {/* No credentials warning */}
        {!hasCredentials && (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 flex-1">No hay credenciales SUNAT configuradas.</p>
            <Link href="/configuracion">
              <Button variant="outline" size="sm" className="gap-2 shrink-0">
                <Settings className="w-3.5 h-3.5" />Configurar
              </Button>
            </Link>
          </div>
        )}

        {hasCredentials && !isConnected && (
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0" />
            <p className="text-sm text-blue-800 flex-1">
              {credStatus?.lastTestOk === false ? "La conexión SUNAT falló. Verifica tus credenciales." : "Credenciales configuradas pero no probadas aún."}
            </p>
            <Link href="/configuracion">
              <Button variant="outline" size="sm" className="gap-2 shrink-0">
                <Settings className="w-3.5 h-3.5" />Probar conexión
              </Button>
            </Link>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium">Total Jobs</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{jobs.length}</p>
          </div>
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 shadow-sm">
            <p className="text-xs text-blue-700 font-medium">En Proceso</p>
            <p className="text-xl font-bold text-blue-600 mt-1">{activeJobs.length}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm">
            <p className="text-xs text-emerald-700 font-medium">Completados</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">{completedJobs.length}</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-200 p-4 shadow-sm">
            <p className="text-xs text-red-700 font-medium">Fallidos</p>
            <p className="text-xl font-bold text-red-600 mt-1">{failedJobs.length}</p>
          </div>
        </div>

        {/* Active jobs progress */}
        {activeJobs.length > 0 && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-2 px-6 pt-4">
              <CardTitle className="text-base text-blue-900 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />Descargas en progreso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeJobs.map((job) => (
                <div key={job.id} className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-900">
                      {TIPO_CONFIG[job.tipo as keyof typeof TIPO_CONFIG]?.label ?? job.tipo}
                    </span>
                    <span className="text-xs text-blue-600 font-bold">{job.progreso}%</span>
                  </div>
                  <Progress value={job.progreso} className="h-2" />
                  <p className="text-xs text-gray-500 mt-1">
                    {job.totalDocs} comprobantes · {job.docsOk} procesados
                    {job.docsError > 0 && <span className="text-red-500 ml-1">· {job.docsError} errores</span>}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Period selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 font-medium">Período:</span>
          <select
            value={selectedPeriod}
            onChange={(e) => { setSelectedPeriod(Number(e.target.value)); setSyncResult(null); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {months.map((m, i) => (
              <option key={i} value={i}>{m.label}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">{months[selectedPeriod].start} → {months[selectedPeriod].end}</span>
        </div>

        {/* STEP 1: Sync */}
        <Card className="border-blue-200">
          <CardHeader className="pb-3 px-6 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">1</div>
              <div>
                <CardTitle className="text-base">Sincronizar con SUNAT</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Descubre comprobantes nuevos del período seleccionado y los registra en el sistema</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button
                onClick={handleSync}
                disabled={syncing || !companyId || !isConnected}
                className="gap-2"
              >
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {syncing ? "Sincronizando..." : "Sincronizar ahora"}
              </Button>
              {syncResult && (
                <div className={`flex items-center gap-2 text-sm ${syncResult.estado === "COMPLETED" ? "text-emerald-700" : "text-red-600"}`}>
                  {syncResult.estado === "COMPLETED"
                    ? <><CheckCircle2 className="w-4 h-4" /> {syncResult.docsNuevos} comprobantes nuevos descubiertos</>
                    : <><XCircle className="w-4 h-4" /> {syncResult.errorMsg}</>
                  }
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* STEP 2: Download files */}
        <Card>
          <CardHeader className="pb-3 px-6 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-700 text-white flex items-center justify-center text-sm font-bold shrink-0">2</div>
              <div>
                <CardTitle className="text-base">Descargar Archivos</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Descarga los archivos XML, PDF y CDR de los comprobantes ya registrados</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(Object.entries(TIPO_CONFIG) as [keyof typeof TIPO_CONFIG, typeof TIPO_CONFIG[keyof typeof TIPO_CONFIG]][]).map(([tipo, config]) => {
                const Icon = config.icon;
                const isCreating = creating === tipo;
                return (
                  <button
                    key={tipo}
                    onClick={() => handleCreate(tipo)}
                    disabled={!!creating || !companyId}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 bg-white hover:border-blue-300 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${config.color}`}>
                      {isCreating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Icon className="w-6 h-6" />}
                    </div>
                    <p className="text-xs font-semibold text-gray-900 text-center">{config.label}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Jobs history */}
        <Card>
          <CardHeader className="pb-0 px-6 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Historial de Descargas</CardTitle>
              <Button variant="outline" size="sm" className="gap-2" onClick={loadJobs}>
                <RefreshCw className="w-3.5 h-3.5" />Actualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Download className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">Sin descargas registradas</p>
                <p className="text-xs mt-1">Sincroniza primero para descubrir comprobantes</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-y border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Período</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Progreso</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Docs</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {jobs.map((job) => {
                      const params = job.parametros as { fechaInicio?: string; fechaFin?: string };
                      return (
                        <tr key={job.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <span className={`text-xs font-mono px-2 py-0.5 rounded font-semibold ${TIPO_CONFIG[job.tipo as keyof typeof TIPO_CONFIG]?.color ?? "bg-gray-100 text-gray-600"}`}>
                              {job.tipo}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-600">
                            {params.fechaInicio && params.fechaFin ? `${params.fechaInicio} → ${params.fechaFin}` : "—"}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Progress value={job.progreso} className="h-1.5 flex-1" />
                              <span className="text-xs text-gray-500 w-8 text-right">{job.progreso}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center text-xs text-gray-600">
                            {job.docsOk}/{job.totalDocs}
                            {job.docsError > 0 && <span className="text-red-500 ml-1">({job.docsError} err)</span>}
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-600">
                            {new Date(job.createdAt).toLocaleString("es-PE")}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant={
                              job.estado === "COMPLETED" ? "success" :
                              job.estado === "FAILED" ? "destructive" :
                              job.estado === "PROCESSING" ? "info" : "secondary"
                            }>
                              {job.estado === "COMPLETED" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                              {job.estado === "FAILED" && <XCircle className="w-3 h-3 mr-1" />}
                              {(job.estado === "PROCESSING" || job.estado === "PENDING") && <Clock className="w-3 h-3 mr-1" />}
                              {job.estado}
                            </Badge>
                            {job.estado === "FAILED" && job.errorMsg && (
                              <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate">{job.errorMsg}</p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
