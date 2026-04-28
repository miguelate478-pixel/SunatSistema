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
import { exportVouchers } from "@/lib/export";
import {
  Search, Download, Eye, FileDown, RefreshCw, AlertTriangle,
  Plus, Upload, ChevronLeft, ChevronRight, Package,
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
  const { vouchers, loading, error, refetch, updateFilters, pagination } = useVouchers("VENTA");
  const { activeCompany } = useActiveCompany();
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("todos");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [selectedDoc, setSelectedDoc] = useState<VoucherDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const filtered = vouchers;
  const totalVentas = filtered.reduce((sum, c) => sum + c.total, 0);
  const totalIGV = filtered.reduce((sum, c) => sum + (c.igv || 0), 0);
  const ventasConDetraccion = filtered.filter((c) => c.afectoDetraccion).length;

  function openDetail(comp: Voucher) { setSelectedDoc(comp as VoucherDetail); setDetailOpen(true); }
  function toggleSelect(id: string) {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === vouchers.length ? new Set() : new Set(vouchers.map((v) => v.id)));
  }
  function handleExport() {
    exportVouchers(vouchers as unknown as Record<string, unknown>[], `ventas_${new Date().toISOString().split("T")[0]}.csv`);
  }
  async function handleSync() {
    if (!activeCompany || syncing) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const now = new Date();
      const fechaInicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const fechaFin = now.toISOString().split("T")[0];
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: activeCompany.id, fechaInicio, fechaFin, downloadFiles: true }),
      });
      const json = await res.json();
      if (json.success) {
        const n = json.data?.docsNuevos ?? 0;
        setSyncMsg(n > 0 ? `✓ ${n} comprobantes nuevos sincronizados` : "✓ Sin comprobantes nuevos");
        refetch();
      } else {
        setSyncMsg(`Error: ${json.error}`);
      }
    } catch {
      setSyncMsg("Error de conexión al sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDownloadZip() {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : vouchers.map((v) => v.id);
    if (!ids.length || !activeCompany) return;
    setDownloadingZip(true);
    try {
      const res = await fetch("/api/vouchers/download-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: activeCompany.id, voucherIds: ids }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error ?? "No hay archivos disponibles"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `ventas_${new Date().toISOString().split("T")[0]}.zip`; a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ } finally { setDownloadingZip(false); }
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

        {syncMsg && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm ${syncMsg.startsWith("✓") ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>
            {syncMsg}
          </div>
        )}

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
              {/* Month selector */}
              <select
                className="text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) { updateFilters({ fechaInicio: undefined, fechaFin: undefined }); return; }
                  const [y, m] = val.split("-");
                  const start = `${y}-${m}-01`;
                  const end = new Date(Number(y), Number(m), 0).toISOString().split("T")[0];
                  updateFilters({ fechaInicio: start, fechaFin: end });
                }}
              >
                <option value="">Todos los períodos</option>
                {Array.from({ length: 36 }, (_, i) => {
                  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
                  const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                  const label = d.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
                  return <option key={val} value={val}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>;
                })}
              </select>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualizar
                </Button>
                <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={handleSync} disabled={syncing || !activeCompany}>
                  {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {syncing ? "Sincronizando..." : "Sincronizar SUNAT"}
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setImportarOpen(true)}>
                  <Upload className="w-3.5 h-3.5" />
                  Importar CSV
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} disabled={vouchers.length === 0}>
                  <FileDown className="w-3.5 h-3.5" />
                  Exportar Excel
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadZip} disabled={downloadingZip || vouchers.length === 0}>
                  {downloadingZip ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                  {selectedIds.size > 0 ? `ZIP (${selectedIds.size})` : "ZIP Masivo"}
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
                    <th className="py-3 px-3 w-8">
                      <input type="checkbox" className="rounded" checked={selectedIds.size === vouchers.length && vouchers.length > 0} onChange={toggleSelectAll} />
                    </th>
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
                      <td className="py-3 px-3">
                        <input type="checkbox" className="rounded" checked={selectedIds.has(comp.id)} onChange={() => toggleSelect(comp.id)} />
                      </td>
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

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <p className="text-xs text-gray-500">
                    Mostrando {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} registros
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => updateFilters({ page: pagination.page - 1 })}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-gray-700 font-medium">Página {pagination.page} de {pagination.totalPages}</span>
                    <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => updateFilters({ page: pagination.page + 1 })}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
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
