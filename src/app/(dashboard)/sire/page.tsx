"use client";

import React, { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useActiveCompany } from "@/lib/hooks/useActiveCompany";
import {
  FileText, Download, CheckCircle2, AlertTriangle, Loader2,
  BookOpen, ShoppingCart, TrendingUp, ExternalLink,
} from "lucide-react";

function getMonths(n = 36) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
    return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
  });
}

export default function SirePage() {
  const { activeCompany } = useActiveCompany();
  const companyId = activeCompany?.id;
  const months = getMonths(36);
  const [periodo, setPeriodo] = useState(months[0].value);
  const [generatingRCE, setGeneratingRCE] = useState(false);
  const [generatingRVIE, setGeneratingRVIE] = useState(false);
  const [rceResult, setRceResult] = useState<{ registros: number; filename: string } | null>(null);
  const [rvieResult, setRvieResult] = useState<{ registros: number; filename: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(tipo: "RCE" | "RVIE") {
    if (!companyId) return;
    const setGenerating = tipo === "RCE" ? setGeneratingRCE : setGeneratingRVIE;
    const setResult = tipo === "RCE" ? setRceResult : setRvieResult;
    setGenerating(true);
    setError(null);

    try {
      // Download directly as file
      const url = `/api/sire?companyId=${companyId}&periodo=${periodo}&tipo=${tipo}`;
      const res = await fetch(url);

      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Error al generar" }));
        setError(json.error ?? "Error al generar el archivo");
        return;
      }

      const registros = parseInt(res.headers.get("X-SIRE-Registros") ?? "0");
      const filename = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `${tipo}_${periodo}.txt`;

      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(downloadUrl);

      setResult({ registros, filename });
    } catch {
      setError("Error de conexión al generar el archivo");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="SIRE" subtitle="Registro de Compras y Ventas Electrónico" />

      <div className="flex-1 overflow-auto p-6 space-y-5 max-w-3xl">

        {/* Info banner */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800 space-y-1">
                <p className="font-semibold">¿Qué es SIRE?</p>
                <p>SIRE (Sistema Integrado de Registros Electrónicos) es el sistema de SUNAT para generar el Registro de Compras (RCE) y el Registro de Ventas (RVIE) en formato electrónico oficial.</p>
                <p className="mt-1"><strong>Flujo operativo:</strong> Genera el archivo TXT aquí → Descárgalo → Súbelo al portal SIRE de SUNAT.</p>
                <a
                  href="https://sire.sunat.gob.pe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-700 underline font-medium mt-1"
                >
                  Ir al portal SIRE <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Period selector */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 shrink-0">Período:</label>
          <select
            value={periodo}
            onChange={(e) => { setPeriodo(e.target.value); setRceResult(null); setRvieResult(null); setError(null); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* RCE */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-base">RCE — Registro de Compras</CardTitle>
                <CardDescription className="text-xs">
                  Genera el archivo TXT del Registro de Compras Electrónico (estructura 8.1 PLE)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {rceResult && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <div>
                  <p className="font-medium">Archivo generado: {rceResult.registros} registros</p>
                  <p className="text-xs text-emerald-700 font-mono">{rceResult.filename}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button
                onClick={() => handleGenerate("RCE")}
                disabled={generatingRCE || !companyId}
                className="gap-2"
              >
                {generatingRCE ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {generatingRCE ? "Generando..." : "Generar y Descargar RCE"}
              </Button>
              <Badge variant="outline" className="text-xs font-mono">LE{activeCompany?.ruc ?? "..."}{periodo.replace("-", "")}00080100001100_1_1.txt</Badge>
            </div>
            <p className="text-xs text-gray-500">
              Incluye todos los comprobantes de compra del período donde tu empresa es receptora (RUC receptor = {activeCompany?.ruc ?? "tu RUC"}).
            </p>
          </CardContent>
        </Card>

        {/* RVIE */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">RVIE — Registro de Ventas</CardTitle>
                <CardDescription className="text-xs">
                  Genera el archivo TXT del Registro de Ventas e Ingresos Electrónico (estructura 14.1 PLE)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {rvieResult && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <div>
                  <p className="font-medium">Archivo generado: {rvieResult.registros} registros</p>
                  <p className="text-xs text-emerald-700 font-mono">{rvieResult.filename}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button
                onClick={() => handleGenerate("RVIE")}
                disabled={generatingRVIE || !companyId}
                className="gap-2"
              >
                {generatingRVIE ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {generatingRVIE ? "Generando..." : "Generar y Descargar RVIE"}
              </Button>
              <Badge variant="outline" className="text-xs font-mono">LE{activeCompany?.ruc ?? "..."}{periodo.replace("-", "")}00140100001100_1_1.txt</Badge>
            </div>
            <p className="text-xs text-gray-500">
              Incluye todos los comprobantes de venta del período donde tu empresa es emisora (RUC emisor = {activeCompany?.ruc ?? "tu RUC"}).
            </p>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 space-y-1">
                <p className="font-semibold">Pasos para subir al portal SIRE</p>
                <ol className="list-decimal list-inside space-y-0.5 text-amber-700">
                  <li>Descarga el archivo TXT desde aquí</li>
                  <li>Ingresa a <a href="https://sire.sunat.gob.pe" target="_blank" rel="noopener noreferrer" className="underline">sire.sunat.gob.pe</a> con tu clave SOL</li>
                  <li>Ve al módulo RCE (compras) o RVIE (ventas)</li>
                  <li>Selecciona el período correspondiente</li>
                  <li>Sube el archivo TXT generado</li>
                  <li>Revisa la propuesta y confirma</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
