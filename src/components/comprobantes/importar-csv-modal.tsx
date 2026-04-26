"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X, CheckCircle2, AlertTriangle, Download, FileText, FileCode, Package } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  companyId: string;
  onImported: () => void;
}

const CSV_TEMPLATE = `tipo,serie,numero,fechaEmision,rucEmisor,razonSocialEmisor,rucReceptor,razonSocialReceptor,moneda,subtotal,igv,total,estado
FACTURA,F001,00012345,2026-04-01,20100070970,PROVEEDOR EJEMPLO S.A.C.,20610169849,SHERMAN S.A.C.,PEN,8474.58,1525.42,10000.00,ACEPTADO
FACTURA,F001,00012346,2026-04-05,20503840121,OTRO PROVEEDOR S.A.,20610169849,SHERMAN S.A.C.,PEN,4237.29,762.71,5000.00,ACEPTADO`;

type ImportMode = "xml" | "csv";

export function ImportarCSVModal({ open, onClose, companyId, onImported }: Props) {
  const [mode, setMode] = useState<ImportMode>("xml");
  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [downloadAfter, setDownloadAfter] = useState(true);
  const [result, setResult] = useState<{
    created?: number; updated?: number; skipped?: number;
    errors?: string[]; message: string; ok: boolean;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_comprobantes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(e.target.files ?? []));
    setResult(null);
  }

  async function handleImport() {
    if (files.length === 0 || !companyId) return;
    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("companyId", companyId);

      if (mode === "xml") {
        files.forEach((f) => formData.append("files", f));
        formData.append("downloadAfter", String(downloadAfter));

        const res = await fetch("/api/vouchers/import-xml", { method: "POST", body: formData });
        const json = await res.json();
        if (json.success) {
          setResult({ ...json.data, message: json.message, ok: true });
          onImported();
        } else {
          setResult({ message: json.error, ok: false });
        }
      } else {
        formData.append("file", files[0]);
        const res = await fetch("/api/vouchers/import", { method: "POST", body: formData });
        const json = await res.json();
        if (json.success) {
          setResult({ ...json.data, message: json.message, ok: true });
          onImported();
        } else {
          setResult({ message: json.error, ok: false });
        }
      }
    } catch {
      setResult({ message: "Error de conexión", ok: false });
    } finally {
      setImporting(false);
    }
  }

  if (!open) return null;

  const accept = mode === "xml" ? ".xml,.zip" : ".csv,text/csv";
  const multiple = mode === "xml";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Importar Comprobantes</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Mode selector */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => { setMode("xml"); setFiles([]); setResult(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${mode === "xml" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              <FileCode className="w-4 h-4" />
              XML / ZIP
            </button>
            <button
              onClick={() => { setMode("csv"); setFiles([]); setResult(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${mode === "csv" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              <FileText className="w-4 h-4" />
              CSV
            </button>
          </div>

          {/* Info */}
          {mode === "xml" ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
              <p className="font-semibold mb-1">Importación desde XML/ZIP (recomendado)</p>
              <p>Sube los XMLs que descargaste de SUNAT. El sistema extrae automáticamente todos los datos del comprobante (RUC, montos, ítems, detracción) y los registra en la base de datos.</p>
              <p className="mt-1">Acepta: archivos <strong>.xml</strong> individuales o un <strong>.zip</strong> con múltiples XMLs.</p>
            </div>
          ) : (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800 font-medium mb-2">Formato CSV requerido</p>
              <p className="text-xs text-blue-700 mb-3">
                Columnas: <code className="bg-blue-100 px-1 rounded">tipo, serie, numero, fechaEmision, rucEmisor, razonSocialEmisor, rucReceptor, razonSocialReceptor, moneda, subtotal, igv, total, estado</code>
              </p>
              <Button variant="outline" size="sm" className="gap-2" onClick={downloadTemplate}>
                <Download className="w-3.5 h-3.5" />
                Descargar plantilla CSV
              </Button>
            </div>
          )}

          {/* File picker */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept={accept}
              multiple={multiple}
              className="hidden"
              onChange={handleFileChange}
            />
            {files.length > 0 ? (
              <div className="space-y-1">
                {files.slice(0, 3).map((f, i) => (
                  <div key={i} className="flex items-center justify-center gap-2 text-sm text-gray-700">
                    {f.name.endsWith(".zip") ? <Package className="w-4 h-4 text-amber-600" /> : <FileCode className="w-4 h-4 text-blue-600" />}
                    <span className="font-medium">{f.name}</span>
                    <span className="text-gray-400">({(f.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ))}
                {files.length > 3 && <p className="text-xs text-gray-500">+{files.length - 3} archivos más</p>}
              </div>
            ) : (
              <div>
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  {mode === "xml" ? "Haz clic para seleccionar XML(s) o un ZIP" : "Haz clic para seleccionar el CSV"}
                </p>
                <p className="text-xs text-gray-400 mt-1">o arrastra y suelta aquí</p>
              </div>
            )}
          </div>

          {/* Download after option (XML mode only) */}
          {mode === "xml" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={downloadAfter}
                onChange={(e) => setDownloadAfter(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-700">
                Descargar PDF y CDR automáticamente después de importar
              </span>
            </label>
          )}

          {/* Result */}
          {result && (
            <div className={`p-3 rounded-lg border text-sm ${result.ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center gap-2 mb-1">
                {result.ok
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  : <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
                <span className={`font-medium ${result.ok ? "text-emerald-800" : "text-red-700"}`}>{result.message}</span>
              </div>
              {result.errors && result.errors.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {result.errors.slice(0, 5).map((e, i) => (
                    <li key={i} className="text-xs text-red-600">• {e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleImport} disabled={files.length === 0 || importing} className="gap-2 flex-1">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? "Importando..." : `Importar ${mode === "xml" ? "XML/ZIP" : "CSV"}`}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={importing}>Cerrar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
