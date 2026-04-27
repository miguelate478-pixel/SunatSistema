"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useActiveCompany } from "@/lib/hooks/useActiveCompany";
import {
  Download, RefreshCw, CheckCircle2, XCircle, Clock,
  Loader2, FileCode, FileText, FileDown, Package,
  AlertTriangle, Settings, Info,
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

const TIPO_CONFIG = {
  XML:    { icon: FileCode,  label: "Archivos XML",                  color: "text-emerald-600 bg-emerald-50" },
  PDF:    { icon: FileText,  label: "Archivos PDF",                  color: "text-blue-600 bg-blue-50" },
  CDR:    { icon: FileDown,  label: "Archivos CDR",                  color: "text-violet-600 bg-violet-50" },
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
  const [credStatus, setCredStatus] = useState<SunatCredStatus | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(0);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [useCustom, setUseCustom] = useState(false);
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

  useEffect(() => {
    const run = async () => {
      if (!companyId) return;
      try {
        const res = await fetch(`/api/download-jobs?companyId=${companyId}`);
        const json = await res.json();
        if (json.success) setJobs(json.data);
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    };
    run();
  }, [companyId]);

  useEffect(() => {
    const hasActive = jobs.some((j) => j.estado === "PENDING" || j.estado === "PROCESSING");
    if (!hasActive) return;
    const interval = setInterval(loadJobs, 2000);
    return () => clearInterval(interval);
  }, [jobs, loadJobs]);

  function getPeriod() {
    if (useCustom && customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    return { start: months[selectedPeriod].start, end: months[selectedPeriod].end };
  }

  async function handleCreate(tipo: "XML" | "PDF" | "CDR" | "MASIVO") {
    if (!companyId || creating) return;
    setCreating(tipo);
    try {
      const period = getPeriod();
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
  const period = getPeriod();

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Descargas SUNAT" subtitle="Descarga de archivos XML, PDF y CDR" />

      <div className="flex-1 overflow-auto p-6 space-y-5">

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
          <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
            <p className="text-sm text-orange-800 flex-1">
              {credStatus?.lastTestOk === false ? "Conexión SUNAT fallida — verifica credenciales." : "Credenciales no probadas aún."}
            </p>
            <Link href="/configuracion">
              <Button variant="outline" size="sm" className="gap-2 shrink-0">
                <Settings className="w-3.5 h-3.5" />Probar conexión
              </Button>
            </Link>
          </div>
        )}

        {/* Info banner */}
        <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800">
            <p className="font-semibold mb-0.5">¿Cómo funciona?</p>
            <p>Selecciona el período y el tipo de archivo. El sistema descargará los archivos de los comprobantes que ya están registrados en el sistema para ese período. Para registrar nuevos comprobantes, ve a <Link href="/compras" className="underline font-medium">Compras</Link> o <Link href="/ventas" className="underline font-medium">Ventas</Link>.</p>
          </div>
        </div>

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

        {/* Active jobs */}
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

        {/* Download card */}
        <Card>
          <CardHeader className="pb-3 px-6 pt-4">
            <CardTitle className="text-base">Nueva Descarga</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Period selector */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-sm font-medium text-gray-700 shrink-0">Período:</label>
                <select
                  value={useCustom ? "custom" : selectedPeriod}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setUseCustom(true);
                    } else {
                      setUseCustom(false);
                      setSelectedPeriod(Number(e.target.value));
                    }
                  }}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {months.map((m, i) => (
                    <option key={i} value={i}>{m.label}</option>
                  ))}
                  <option value="custom">Rango personalizado...</option>
                </select>
                {!useCustom && (
                  <span className="text-xs text-gray-400">{period.start} → {period.end}</span>
                )}
              </div>

              {useCustom && (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 shrink-0">Desde:</label>
                    <Input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-40 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 shrink-0">Hasta:</label>
                    <Input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-40 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Download type buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(Object.entries(TIPO_CONFIG) as [keyof typeof TIPO_CONFIG, typeof TIPO_CONFIG[keyof typeof TIPO_CONFIG]][]).map(([tipo, config]) => {
                const Icon = config.icon;
                const isCreating = creating === tipo;
                const disabled = !!creating || !companyId || (useCustom && (!customStart || !customEnd));
                return (
                  <button
                    key={tipo}
                    onClick={() => handleCreate(tipo)}
                    disabled={disabled}
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

        {/* History */}
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
                <p className="text-xs mt-1">Selecciona un período y tipo de archivo arriba</p>
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
