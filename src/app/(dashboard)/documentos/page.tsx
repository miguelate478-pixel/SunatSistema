"use client";

import React, { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocuments } from "@/lib/hooks/useDocuments";
import { formatDate } from "@/lib/utils";
import {
  Search,
  FolderOpen,
  FileText,
  Download,
  Eye,
  Filter,
  Grid3x3,
  List,
  FileCode,
  FileDown,
  Calendar,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

function DocumentosSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="Documentos" subtitle="Repositorio documental inteligente" />
      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        {/* Search and filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-40" />
            </div>
          </CardContent>
        </Card>
        {/* Folders grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        {/* Recent files */}
        <Card>
          <CardHeader className="pb-0 px-6 pt-4">
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-8 w-16 ml-auto" />
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

export default function DocumentosPage() {
  const { documents, loading, error, refetch } = useDocuments();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  const totalXML = documents.filter(d => d.tieneXML).length;
  const totalPDF = documents.filter(d => d.tienePDF).length;
  const totalCDR = documents.filter(d => d.tieneCDR).length;

  const folders = [
    { name: "2024", type: "year", count: documents.length, icon: Calendar },
    { name: "Facturas", type: "type", count: documents.filter(d => d.tipo === "FACTURA").length, icon: FileText },
    { name: "Boletas", type: "type", count: documents.filter(d => d.tipo === "BOLETA").length, icon: FileText },
    { name: "Notas de Crédito", type: "type", count: documents.filter(d => d.tipo === "NOTA_CREDITO").length, icon: FileText },
    { name: "XML", type: "format", count: totalXML, icon: FileCode },
    { name: "PDF", type: "format", count: totalPDF, icon: FileText },
    { name: "CDR", type: "format", count: totalCDR, icon: FileDown },
  ];

  if (loading) {
    return <DocumentosSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Documentos" subtitle="Repositorio documental inteligente" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar datos</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={refetch}>Reintentar</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Documentos" subtitle="Repositorio documental inteligente" />

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium">Total Documentos</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{documents.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Almacenados</p>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm">
            <p className="text-xs text-emerald-700 font-medium">Archivos XML</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">{totalXML}</p>
            <p className="text-xs text-emerald-600 mt-0.5">Disponibles</p>
          </div>
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 shadow-sm">
            <p className="text-xs text-blue-700 font-medium">Archivos PDF</p>
            <p className="text-xl font-bold text-blue-600 mt-1">{totalPDF}</p>
            <p className="text-xs text-blue-600 mt-0.5">Disponibles</p>
          </div>
          <div className="bg-violet-50 rounded-xl border border-violet-200 p-4 shadow-sm">
            <p className="text-xs text-violet-700 font-medium">Archivos CDR</p>
            <p className="text-xl font-bold text-violet-600 mt-1">{totalCDR}</p>
            <p className="text-xs text-violet-600 mt-0.5">Disponibles</p>
          </div>
        </div>

        {/* Search and filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar por RUC, serie, proveedor, cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3x3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-3.5 h-3.5" />
                Filtros
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={refetch}>
                <RefreshCw className="w-3.5 h-3.5" />
                Actualizar
              </Button>
              <Button size="sm" className="gap-2">
                <Download className="w-3.5 h-3.5" />
                Descargar Selección
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <FolderOpen className="w-4 h-4" />
          <span className="font-medium text-gray-900">Documentos</span>
          <span>/</span>
          <span>Todos los archivos</span>
        </div>

        {/* Folders grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {folders.map((folder) => {
            const Icon = folder.icon;
            return (
              <button
                key={folder.name}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-900 truncate w-full">{folder.name}</p>
                  <p className="text-xs text-gray-400">{folder.count} archivos</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Recent files */}
        <Card>
          <CardHeader className="pb-0 px-6 pt-4">
            <CardTitle className="text-base">Archivos Recientes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-y border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Empresa</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Formatos</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {documents.slice(0, 10).map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="text-xs font-mono font-medium text-gray-900">
                            {doc.serie}-{doc.numero}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">
                          {doc.tipo.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-xs text-gray-900 max-w-[180px] truncate">
                          {doc.razonSocialEmisor}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600 whitespace-nowrap">
                        {formatDate(doc.fechaEmision)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          {doc.tieneXML && (
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">
                              XML
                            </span>
                          )}
                          {doc.tienePDF && (
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">
                              PDF
                            </span>
                          )}
                          {doc.tieneCDR && (
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold">
                              CDR
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon-sm" title="Ver">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" title="Descargar">
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {documents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <FileText className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No se encontraron documentos</p>
                  <p className="text-xs mt-1">No hay documentos almacenados</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Info card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                <FolderOpen className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">Organización Automática</h4>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Los documentos se organizan automáticamente por empresa, año, mes y tipo. 
                  Puedes buscar por RUC, serie, proveedor o monto. Todos los archivos están respaldados y encriptados.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}