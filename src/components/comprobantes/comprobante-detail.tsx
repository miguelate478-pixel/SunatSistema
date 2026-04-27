"use client";

import React, { useState, useEffect } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  FileText,
  FileCode,
  FileDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Calendar,
  DollarSign,
  Percent,
  Clock,
  Loader2,
} from "lucide-react";

export interface VoucherDetail {
  id: string;
  tipo: string;
  serie: string;
  numero: string;
  estado: string;
  razonSocialEmisor: string;
  rucEmisor: string;
  razonSocialReceptor: string;
  rucReceptor: string;
  fechaEmision: string;
  fechaVencimiento?: string;
  moneda: string;
  subtotal: number;
  igv: number;
  total: number;
  tieneXML: boolean;
  tienePDF: boolean;
  tieneCDR: boolean;
  afectoDetraccion: boolean;
  porcentajeDetraccion?: number;
  montoDetraccion?: number;
  estadoDetraccion?: string;
  observaciones?: string;
  items?: Array<{
    descripcion: string;
    cantidad: number;
    unidad: string;
    precioUnitario: number;
    subtotal: number;
    igv: number;
    total: number;
  }>;
  documents?: Array<{
    id: string;
    tipo: string;
    filename: string;
    filesize: number;
    uploadedAt: string;
    downloadUrl: string | null;
  }>;
  detraccion?: {
    porcentaje: number;
    monto: number;
    estado: string;
    fechaPago?: string;
    numeroConstancia?: string;
  } | null;
}

interface ComprobanteDetailProps {
  comprobante: VoucherDetail | null;
  open: boolean;
  onClose: () => void;
}

function FileStatusBadge({
  label,
  available,
  downloadUrl,
  filename,
}: {
  label: string;
  available: boolean;
  downloadUrl?: string | null;
  filename?: string;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!downloadUrl) return;
    setDownloading(true);
    try {
      const res = await fetch(downloadUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? `${label.toLowerCase()}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border ${
      available
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : "bg-gray-50 border-gray-200 text-gray-400"
    }`}>
      {available ? (
        <CheckCircle2 className="w-4 h-4 shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 shrink-0" />
      )}
      <span className="text-sm font-semibold">{label}</span>
      {available && downloadUrl && (
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="ml-1 p-0.5 rounded hover:bg-emerald-100 transition-colors"
          title={`Descargar ${label}`}
        >
          {downloading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Download className="w-3.5 h-3.5" />}
        </button>
      )}
      {available && !downloadUrl && (
        <span className="text-xs text-emerald-600 ml-1">✓</span>
      )}
    </div>
  );
}

export function ComprobanteDetail({ comprobante: initialData, open, onClose }: ComprobanteDetailProps) {
  const [detail, setDetail] = useState<VoucherDetail | null>(initialData);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load full detail with documents when opened
  useEffect(() => {
    if (!open || !initialData?.id) return;

    const loadFull = async () => {
      setDetail(initialData);
      setLoadingDetail(true);
      try {
        const res = await fetch(`/api/vouchers/${initialData.id}`);
        const json = await res.json();
        if (json.success) setDetail(json.data);
      } catch { /* use initial data */ } finally {
        setLoadingDetail(false);
      }
    };
    loadFull();
  }, [open, initialData?.id]);

  if (!detail) return null;

  const xmlDoc = detail.documents?.find((d) => d.tipo === "XML");
  const pdfDoc = detail.documents?.find((d) => d.tipo === "PDF");
  const cdrDoc = detail.documents?.find((d) => d.tipo === "CDR");

  async function downloadAll() {
    const docs = detail?.documents?.filter((d) => d.downloadUrl) ?? [];
    for (const doc of docs) {
      if (!doc.downloadUrl) continue;
      try {
        const res = await fetch(doc.downloadUrl);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.filename;
        a.click();
        URL.revokeObjectURL(url);
        await new Promise((r) => setTimeout(r, 300));
      } catch { /* skip */ }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>{detail.tipo.replace("_", " ")} {detail.serie}-{detail.numero}</span>
            </div>
            <Badge variant={
              detail.estado === "ACEPTADO" ? "success" :
              detail.estado === "RECHAZADO" ? "destructive" :
              detail.estado === "OBSERVADO" ? "warning" : "secondary"
            }>
              {detail.estado}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {loadingDetail && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}

        <div className="space-y-5">
          {detail.observaciones && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">{detail.observaciones}</p>
            </div>
          )}

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Emisor</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{detail.razonSocialEmisor}</p>
              <p className="text-xs text-gray-500 mt-0.5">RUC: {detail.rucEmisor}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Receptor</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{detail.razonSocialReceptor}</p>
              <p className="text-xs text-gray-500 mt-0.5">RUC: {detail.rucReceptor}</p>
            </div>
          </div>

          {/* Dates + currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Fecha Emisión</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(detail.fechaEmision)}</p>
              </div>
            </div>
            {detail.fechaVencimiento && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Vencimiento</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(detail.fechaVencimiento)}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Moneda</p>
                <p className="text-sm font-medium text-gray-900">{detail.moneda}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Items */}
          {detail.items && detail.items.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Detalle de Ítems</h4>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase">Descripción</th>
                      <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase">Cant.</th>
                      <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase">Unid.</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase">P. Unit.</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase">Subtotal</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase">IGV</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detail.items.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3 text-xs font-medium text-gray-900 max-w-[200px]">{item.descripcion}</td>
                        <td className="py-2.5 px-3 text-center text-xs text-gray-600">{item.cantidad}</td>
                        <td className="py-2.5 px-3 text-center text-xs text-gray-600">{item.unidad}</td>
                        <td className="py-2.5 px-3 text-right text-xs text-gray-600">{formatCurrency(item.precioUnitario)}</td>
                        <td className="py-2.5 px-3 text-right text-xs text-gray-600">{formatCurrency(item.subtotal)}</td>
                        <td className="py-2.5 px-3 text-right text-xs text-gray-600">{formatCurrency(item.igv)}</td>
                        <td className="py-2.5 px-3 text-right text-xs font-semibold text-gray-900">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={4} className="py-2.5 px-3 text-xs font-semibold text-gray-700 text-right">Totales:</td>
                      <td className="py-2.5 px-3 text-right text-xs font-semibold">{formatCurrency(detail.subtotal)}</td>
                      <td className="py-2.5 px-3 text-right text-xs font-semibold">{formatCurrency(detail.igv)}</td>
                      <td className="py-2.5 px-3 text-right text-sm font-bold text-blue-600">{formatCurrency(detail.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Totals summary (when no items) */}
          {(!detail.items || detail.items.length === 0) && (
            <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <p className="text-xs text-gray-500">Subtotal</p>
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(detail.subtotal)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">IGV (18%)</p>
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(detail.igv)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-base font-bold text-blue-600">{formatCurrency(detail.total)} {detail.moneda}</p>
              </div>
            </div>
          )}

          {/* Detracción */}
          {detail.afectoDetraccion && (
            <>
              <Separator />
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Percent className="w-4 h-4 text-amber-600" />
                  <h4 className="text-sm font-semibold text-amber-900">Detracción SPOT</h4>
                  <Badge variant={
                    detail.estadoDetraccion === "PAGADO" ? "success" :
                    detail.estadoDetraccion === "VENCIDO" ? "destructive" : "warning"
                  }>
                    {detail.estadoDetraccion ?? "PENDIENTE"}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-amber-700">Porcentaje</p>
                    <p className="text-sm font-bold text-amber-900">{detail.porcentajeDetraccion}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-700">Monto Detracción</p>
                    <p className="text-sm font-bold text-amber-900">{formatCurrency(detail.montoDetraccion || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-700">Neto a Pagar</p>
                    <p className="text-sm font-bold text-amber-900">{formatCurrency(detail.total - (detail.montoDetraccion || 0))}</p>
                  </div>
                </div>
                {detail.detraccion?.fechaPago && (
                  <p className="text-xs text-amber-700 mt-2">
                    Pagado: {formatDate(detail.detraccion.fechaPago)}
                    {detail.detraccion.numeroConstancia && ` · Constancia: ${detail.detraccion.numeroConstancia}`}
                  </p>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* File status + download */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900">Archivos del Comprobante</h4>
              {(detail.tieneXML || detail.tienePDF || detail.tieneCDR) && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadAll}>
                  <Download className="w-3.5 h-3.5" />
                  Descargar todos
                </Button>
              )}
            </div>
            <div className="flex gap-3 flex-wrap">
              <FileStatusBadge
                label="XML"
                available={detail.tieneXML}
                downloadUrl={xmlDoc?.downloadUrl}
                filename={xmlDoc?.filename}
              />
              <FileStatusBadge
                label="PDF"
                available={detail.tienePDF}
                downloadUrl={pdfDoc?.downloadUrl}
                filename={pdfDoc?.filename}
              />
              <FileStatusBadge
                label="CDR"
                available={detail.tieneCDR}
                downloadUrl={cdrDoc?.downloadUrl}
                filename={cdrDoc?.filename}
              />
            </div>

            {/* Document history */}
            {detail.documents && detail.documents.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Historial de archivos</p>
                {detail.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 py-1.5 px-3 bg-gray-50 rounded-lg">
                    {doc.tipo === "XML" && <FileCode className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {doc.tipo === "PDF" && <FileText className="w-4 h-4 text-blue-600 shrink-0" />}
                    {doc.tipo === "CDR" && <FileDown className="w-4 h-4 text-violet-600 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{doc.filename}</p>
                      <p className="text-xs text-gray-400">
                        {(doc.filesize / 1024).toFixed(1)} KB · {new Date(doc.uploadedAt).toLocaleString("es-PE")}
                      </p>
                    </div>
                    {doc.downloadUrl && (
                      <a
                        href={doc.downloadUrl}
                        download={doc.filename}
                        className="text-blue-600 hover:text-blue-800"
                        title="Descargar"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* No files message */}
            {!detail.tieneXML && !detail.tienePDF && !detail.tieneCDR && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
                <Clock className="w-4 h-4 shrink-0" />
                <span>No hay archivos descargados. Ve a <strong>Descargas SUNAT</strong> para obtenerlos.</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
