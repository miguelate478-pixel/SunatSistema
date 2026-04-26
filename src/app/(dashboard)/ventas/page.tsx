"use client";

import React, { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ComprobanteDetail } from "@/components/comprobantes/comprobante-detail";
import type { VoucherDetail } from "@/components/comprobantes/comprobante-detail";
import { NuevoComprobanteModal } from "@/components/comprobantes/nuevo-comprobante-modal";
import { ImportarCSVModal } from "@/components/comprobantes/importar-csv-modal";
import { useVouchers, type Voucher } from "@/lib/hooks/useVouchers";
import { useActiveCompany } from "@/lib/hooks/useActiveCompany";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Search,
  Download,
  Eye,
  FileDown,
  RefreshCw,
  AlertTriangle,
  Plus,
  Upload,
} from "lucide-react";

function VentasSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="Ventas" subtitle="Registro de comprobantes de venta" />
      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-10 flex-1 min-w-[200px]" />
              <Skeleton className="h-10 w-44" />
              <Skeleton className="h-10 w-44" />
              <div className="flex gap-2 ml-auto">
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-9 w-40" />
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Table */}
        <Card>
          <CardHeader className="pb-0 px-6 pt-4">
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16 ml-auto" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VentasPage() {
  const { vouchers, loading, error, refetch, updateFilters } = useVouchers("VENTA");
  const { activeCompany } = useActiveCompany();
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("todos");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [selectedDoc, setSelectedDoc] = useState<VoucherDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);

  const filtered = vouchers; // Filtering done server-side

  const totalVentas = filtered.reduce((sum, c) => sum + c.total, 0);
  const totalIGV = filtered.reduce((sum, c) => sum + (c.igv || 0), 0);
  const ventasConDetraccion = filtered.filter((c) => c.afectoDetraccion).length;

  function openDetail(comp: Voucher) {
    setSelectedDoc(comp as VoucherDetail);
    setDetailOpen(true);
  }

  if (loading) {
    return <VentasSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Ventas" subtitle="Registro de comprobantes de venta" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar datos</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => refetch()}>Reintentar</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Ventas" subtitle="Registro de comprobantes de venta" />

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium">Total Ventas</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalVentas)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{filtered.length} comprobantes</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium">IGV Débito Fiscal</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalIGV)}</p>
            <p className="text-xs text-gray-400 mt-0.5">A declarar</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium">Aceptados SUNAT</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">
              {filtered.filter((c) => c.estado === "ACEPTADO").length}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">de {filtered.length} total</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium">Con Detracción</p>
            <p className="text-xl font-bold text-amber-600 mt-1">
              {ventasConDetraccion}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">comprobantes afectos</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar por RUC, cliente, serie..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    updateFilters({ search: e.target.value || undefined });
                  }}
                  className="pl-9"
                />
              </div>
              <Select value={filterTipo} onValueChange={(v) => { setFilterTipo(v); updateFilters({ tipoDoc: v === "todos" ? undefined : v }); }}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  <SelectItem value="FACTURA">Factura</SelectItem>
                  <SelectItem value="BOLETA">Boleta</SelectItem>
                  <SelectItem value="NOTA_CREDITO">Nota de Crédito</SelectItem>
                  <SelectItem value="NOTA_DEBITO">Nota de Débito</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterEstado} onValueChange={(v) => { setFilterEstado(v); updateFilters({ estado: v === "todos" ? undefined : v }); }}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="ACEPTADO">Aceptado</SelectItem>
                  <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                  <SelectItem value="OBSERVADO">Observado</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Input type="date" className="w-36 text-xs" onChange={(e) => updateFilters({ fechaInicio: e.target.value || undefined })} />
                <span className="text-gray-400 text-xs">—</span>
                <Input type="date" className="w-36 text-xs" onChange={(e) => updateFilters({ fechaFin: e.target.value || undefined })} />
              </div>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualizar
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setImportarOpen(true)}>
                  <Upload className="w-3.5 h-3.5" />
                  Importar CSV
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <FileDown className="w-3.5 h-3.5" />
                  Exportar
                </Button>
                <Button size="sm" className="gap-2" onClick={() => setNuevoOpen(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  Nueva Factura
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-0 px-6 pt-4">
            <CardTitle className="text-base">
              Comprobantes de Venta
              <span className="ml-2 text-sm font-normal text-gray-500">({filtered.length} registros)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-y border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Comprobante</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subtotal</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">IGV</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Archivos</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Detracción</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((comp) => (
                    <tr key={comp.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="py-3 px-4">
                        <p className="text-xs font-mono font-semibold text-gray-900">{comp.serie}-{comp.numero}</p>
                        <Badge variant={comp.tipo === "FACTURA" ? "info" : comp.tipo === "BOLETA" ? "secondary" : "warning"} className="text-xs mt-0.5">
                          {comp.tipo.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-xs font-medium text-gray-900 max-w-[180px] truncate">
                          {comp.razonSocialReceptor || "Cliente no especificado"}
                        </p>
                        <p className="text-xs text-gray-400">{comp.rucReceptor || "Sin RUC"}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600 whitespace-nowrap">{formatDate(comp.fechaEmision)}</td>
                      <td className="py-3 px-4 text-right text-xs text-gray-600">{formatCurrency(comp.subtotal || comp.total * 0.82)}</td>
                      <td className="py-3 px-4 text-right text-xs text-gray-600">{formatCurrency(comp.igv || comp.total * 0.18)}</td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-xs font-bold text-gray-900">{formatCurrency(comp.total)}</span>
                        {comp.moneda === "USD" && <span className="text-xs text-gray-400 ml-1">USD</span>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          {[
                            { label: "XML", has: comp.tieneXML },
                            { label: "PDF", has: comp.tienePDF },
                            { label: "CDR", has: comp.tieneCDR },
                          ].map(({ label, has }) => (
                            <span key={label} className={`text-xs font-mono px-1.5 py-0.5 rounded font-semibold ${has ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                              {label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {comp.afectoDetraccion ? (
                          <div className="flex flex-col items-center">
                            <Badge variant={comp.estadoDetraccion === "PAGADO" ? "success" : comp.estadoDetraccion === "VENCIDO" ? "destructive" : "warning"} className="text-xs">
                              {comp.porcentajeDetraccion || 10}%
                            </Badge>
                            <span className="text-xs text-gray-400 mt-0.5">{comp.estadoDetraccion || "PENDIENTE"}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={comp.estado === "ACEPTADO" ? "success" : comp.estado === "RECHAZADO" ? "destructive" : comp.estado === "OBSERVADO" ? "warning" : "secondary"}>
                          {comp.estado}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon-sm" onClick={() => openDetail(comp)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm">
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <ComprobanteDetail comprobante={selectedDoc} open={detailOpen} onClose={() => setDetailOpen(false)} />
      <NuevoComprobanteModal
        open={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        companyId={activeCompany?.id ?? ""}
        companyRuc={activeCompany?.ruc ?? ""}
        mode="VENTA"
        onCreated={refetch}
      />
      <ImportarCSVModal
        open={importarOpen}
        onClose={() => setImportarOpen(false)}
        companyId={activeCompany?.id ?? ""}
        onImported={refetch}
      />
    </div>
  );
}
