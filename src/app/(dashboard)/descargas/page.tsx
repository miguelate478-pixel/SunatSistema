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
  periodo: string;
  numTicket: string;
  status: string;
  progress: number;
  errorMessage: string | null;
  resultData: Record<string, unknown> | null;
  createdAt: string;
  completedAt: string | null;
}

interface SunatCredStatus {
  isActive: boolean;
  lastTestOk: boolean | null;
  ruc: string;
}

const TIPO_CONFIG = {
  "propuesta-compras": { icon: FileCode,  label: "Compras (SIRE)",    color: "text-emerald-600 bg-emerald-50" },
  "propuesta-ventas":  { icon: FileText,  label: "Ventas (SIRE)",     color: "text-blue-600 bg-blue-50" },
  "resumen":           { icon: FileDown,  label: "Resumen",           color: "text-violet-600 bg-violet-50" },
  "comprobantes":      { icon: Package,   label: "Comprobantes",      color: "text-amber-600 bg-amber-50" },
};

function getMonths(n = 24) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const label = d.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
    const periodo = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { label: label.charAt(0).toUpperCase() + label.slice(1), periodo };
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
  const months = getMonths(24);

  const loadJobs = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await fetch(`/api/sunat/jobs?companyId=${companyId}`);
      const json = await res.json();
      if (json.success) setJobs(json.data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/sunat/credentials?companyId=${companyId}`)
      .then(r => r.json())
      .then(j => { if (j.success && j.data) setCredStatus(j.data); })
      .catch(() => {});
    loadJobs();
  }, [companyId, loadJobs]);

  // Auto-refresh while jobs are running — calls process-job to advance them
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === "PENDING" || j.status === "RUNNING");
    if (!hasActive) return;

    const interval = setInterval(async () => {
      // Process each active job
      const activeJobs = jobs.filter((j) => j.status === "PENDING" || j.status === "RUNNING");
      await Promise.all(
        activeJobs.map((job) =>
          fetch("/api/sunat/process-job", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId: job.id }),
          }).catch(() => {})
        )
      );
      // Refresh job list
      await loadJobs();
    }, 4000);

    return () => clearInterval(interval);
  }, [jobs, loadJobs]);

  async function handleCreate(tipo: keyof typeof TIPO_CONFIG) {
    if (!companyId || creating) return;
    setCreating(tipo);
    try {
      const periodo = months[selectedPeriod].periodo;
      const res = await fetch("/api/sunat/request-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, tipo, periodo }),
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

  const activeJobs  = jobs.filter((j) => j.status === "PENDING" || j.status === "RUNNING");
  const completedJobs = jobs.filter((j) => j.status === "SUCCESS");
  const failedJobs  = jobs.filter((j) => j.status === "FAILED");
  const isConnected = credStatus?.lastTestOk === true;
  const hasCredentials = !!credStatus;

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Descargas SUNAT" subtitle="Descarga de comprobantes desde SIRE/SUNAT" />

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

        <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800">
            Selecciona el período y el tipo de descarga. El sistema solicitará el ticket a SUNAT y procesará los comprobantes automáticamente.
          </p>
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
                      {TIPO_CONFIG[job.tipo as keyof typeof TIPO_CONFIG]?.label ?? job.tipo} — {job.periodo}
                    </span>
                    <span className="text-xs text-blue-600 font-bold">{job.progress}%</span>
                  </div>
                  <Progress value={job.progress} className="h-2" />
                  <p className="text-xs text-gray-500 mt-1">Ticket: {job.numTicket}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* New download card */}
        <Card>
          <CardHeader className="pb-3 px-6 pt-4">
            <CardTitle className="text-base">Nueva Descarga</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-sm font-medium text-gray-700 shrink-0">Período:</label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(Number(e.target.value))}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {months.map((m, i) => (
                  <option key={i} value={i}>{m.label} ({m.periodo})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(Object.entries(TIPO_CONFIG) as [keyof typeof TIPO_CONFIG, typeof TIPO_CONFIG[keyof typeof TIPO_CONFIG]][]).map(([tipo, config]) => {
                const Icon = config.icon;
                const isCreating = creating === tipo;
                const disabled = !!creating || !companyId || !hasCredentials;
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
              <Button variant="outline" size="sm" className="gap-2" onClick={() => loadJobs()}>
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
                <p className="text-xs mt-1">Selecciona un período y tipo de descarga arriba</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-y border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Período</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Progreso</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Ticket</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className={`text-xs font-mono px-2 py-0.5 rounded font-semibold ${TIPO_CONFIG[job.tipo as keyof typeof TIPO_CONFIG]?.color ?? "bg-gray-100 text-gray-600"}`}>
                            {TIPO_CONFIG[job.tipo as keyof typeof TIPO_CONFIG]?.label ?? job.tipo}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600">{job.periodo}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Progress value={job.progress} className="h-1.5 flex-1" />
                            <span className="text-xs text-gray-500 w-8 text-right">{job.progress}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-gray-500 max-w-[120px] truncate">{job.numTicket}</td>
                        <td className="py-3 px-4 text-xs text-gray-600">
                          {new Date(job.createdAt).toLocaleString("es-PE")}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={
                            job.status === "SUCCESS" ? "success" :
                            job.status === "FAILED"  ? "destructive" :
                            job.status === "RUNNING" ? "info" : "secondary"
                          }>
                            {job.status === "SUCCESS" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {job.status === "FAILED"  && <XCircle className="w-3 h-3 mr-1" />}
                            {(job.status === "RUNNING" || job.status === "PENDING") && <Clock className="w-3 h-3 mr-1" />}
                            {job.status}
                          </Badge>
                          {job.status === "FAILED" && job.errorMessage && (
                            <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate">{job.errorMessage}</p>
                          )}
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
