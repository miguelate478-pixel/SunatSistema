"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X, CheckCircle2, AlertTriangle, Download, FileText } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  companyId: string;
  onImported: () => void;
}

const CSV_TEMPLATE = `tipo,serie,numero,fechaEmision,rucEmisor,razonSocialEmisor,rucReceptor,razonSocialReceptor,moneda,subtotal,igv,total,estado
FACTURA,F001,00012345,2026-04-01,20100070970,PROVEEDOR EJEMPLO S.A.C.,20610169849,SHERMAN S.A.C.,PEN,8474.58,1525.42,10000.00,ACEPTADO
FACTURA,F001,00012346,2026-04-05,20503840121,OTRO PROVEEDOR S.A.,20610169849,SHERMAN S.A.C.,PEN,4237.29,762.71,5000.00,ACEPTADO`;

export function ImportarCSVModal({ open, onClose, companyId, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[]; message: string } | null>(null);
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

  async function handleImport() {
    if (!file || !companyId) return;
    setImporting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("companyId", companyId);
      formData.append("file", file);

      const res = await fetch("/api/vouchers/import", { method: "POST", body: formData });
      const json = await res.json();
      if (json.success) {
        setResult({ ...json.data, message: json.message });
        onImported();
      } else {
        setResult({ created: 0, skipped: 0, errors: [json.error], message: json.error });
      }
    } catch {
      setResult({ created: 0, skipped: 0, errors: ["Error de conexión"], message: "Error de conexión" });
    } finally {
      setImporting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Importar Comprobantes desde CSV</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Template download */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800 font-medium mb-2">Formato requerido</p>
            <p className="text-xs text-blue-700 mb-3">
              El CSV debe tener estas columnas: <code className="bg-blue-100 px-1 rounded">tipo, serie, numero, fechaEmision, rucEmisor, razonSocialEmisor, rucReceptor, razonSocialReceptor, moneda, subtotal, igv, total, estado</code>
            </p>
            <Button variant="outline" size="sm" className="gap-2" onClick={downloadTemplate}>
              <Download className="w-3.5 h-3.5" />
              Descargar plantilla CSV
            </Button>
          </div>

          {/* File picker */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="font-medium">{file.name}</span>
                <span className="text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            ) : (
              <div>
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Haz clic para seleccionar un archivo CSV</p>
                <p className="text-xs text-gray-400 mt-1">o arrastra y suelta aquí</p>
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className={`p-3 rounded-lg border text-sm ${result.created > 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center gap-2 mb-1">
                {result.created > 0
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  : <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
                <span className={`font-medium ${result.created > 0 ? "text-emerald-800" : "text-red-700"}`}>{result.message}</span>
              </div>
              {result.errors.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-xs text-red-600">• {e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleImport} disabled={!file || importing} className="gap-2 flex-1">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? "Importando..." : "Importar"}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={importing}>Cerrar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
