"use client";

import React from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Calendar,
  DollarSign,
  Percent,
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
}

interface ComprobanteDetailProps {
  comprobante: VoucherDetail | null;
  open: boolean;
  onClose: () => void;
}

function FileStatusBadge({ label, available }: { label: string; available: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border ${
      available
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : "bg-red-50 border-red-200 text-red-600"
    }`}>
      {available ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <XCircle className="w-4 h-4" />
      )}
      <span className="text-sm font-semibold">{label}</span>
      {available && (
        <Button variant="ghost" size="icon-sm" className="ml-1 h-6 w-6 text-emerald-700 hover:bg-emerald-100">
          <Download className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}

export function ComprobanteDetail({ comprobante, open, onClose }: ComprobanteDetailProps) {
  if (!comprobante) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>{comprobante.tipo.replace("_", " ")} {comprobante.serie}-{comprobante.numero}</span>
            </div>
            <Badge variant={
              comprobante.estado === "ACEPTADO" ? "success" :
              comprobante.estado === "RECHAZADO" ? "destructive" :
              comprobante.estado === "OBSERVADO" ? "warning" : "secondary"
            }>
              {comprobante.estado}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Observaciones */}
          {comprobante.observaciones && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">{comprobante.observaciones}</p>
            </div>
          )}

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Emisor</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{comprobante.razonSocialEmisor}</p>
              <p className="text-xs text-gray-500 mt-0.5">RUC: {comprobante.rucEmisor}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Receptor</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{comprobante.razonSocialReceptor}</p>
              <p className="text-xs text-gray-500 mt-0.5">RUC: {comprobante.rucReceptor}</p>
            </div>
          </div>

          {/* Document info */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Fecha Emisión</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(comprobante.fechaEmision)}</p>
              </div>
            </div>
            {comprobante.fechaVencimiento && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Fecha Vencimiento</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(comprobante.fechaVencimiento)}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Moneda</p>
                <p className="text-sm font-medium text-gray-900">{comprobante.moneda}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Items table */}
          {comprobante.items && comprobante.items.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Detalle de Ítems</h4>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Descripción</th>
                    <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cant.</th>
                    <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Unid.</th>
                    <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">P. Unit.</th>
                    <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subtotal</th>
                    <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">IGV</th>
                    <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {comprobante.items.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 text-gray-900 max-w-[200px]">
                        <p className="text-xs font-medium">{item.descripcion}</p>
                      </td>
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
                    <td className="py-2.5 px-3 text-right text-xs font-semibold text-gray-900">{formatCurrency(comprobante.subtotal)}</td>
                    <td className="py-2.5 px-3 text-right text-xs font-semibold text-gray-900">{formatCurrency(comprobante.igv)}</td>
                    <td className="py-2.5 px-3 text-right text-sm font-bold text-blue-600">{formatCurrency(comprobante.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          )}

          {/* Detracción */}
          {comprobante.afectoDetraccion && (
            <>
              <Separator />
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Percent className="w-4 h-4 text-amber-600" />
                  <h4 className="text-sm font-semibold text-amber-900">Detracción</h4>
                  <Badge variant={
                    comprobante.estadoDetraccion === "PAGADO" ? "success" :
                    comprobante.estadoDetraccion === "VENCIDO" ? "destructive" : "warning"
                  }>
                    {comprobante.estadoDetraccion}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-amber-700">Porcentaje</p>
                    <p className="text-sm font-bold text-amber-900">{comprobante.porcentajeDetraccion}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-700">Monto Detracción</p>
                    <p className="text-sm font-bold text-amber-900">{formatCurrency(comprobante.montoDetraccion || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-700">Neto a Pagar</p>
                    <p className="text-sm font-bold text-amber-900">{formatCurrency(comprobante.total - (comprobante.montoDetraccion || 0))}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* File status */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Archivos del Comprobante</h4>
            <div className="flex gap-3">
              <FileStatusBadge label="XML" available={comprobante.tieneXML} />
              <FileStatusBadge label="PDF" available={comprobante.tienePDF} />
              <FileStatusBadge label="CDR" available={comprobante.tieneCDR} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              Descargar ZIP
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <FileCode className="w-4 h-4" />
              Ver XML
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="w-4 h-4" />
              Ver PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
