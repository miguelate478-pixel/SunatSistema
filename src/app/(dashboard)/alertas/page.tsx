"use client";

import React, { useState, useMemo } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAlerts } from "@/lib/hooks/useAlerts";
import { formatDateLong } from "@/lib/utils";
import {
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Info,
  FileText,
  Percent,
  Calendar,
  TrendingUp,
  Eye,
  Check,
  RefreshCw,
} from "lucide-react";

function AlertasSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="Alertas" subtitle="Centro de notificaciones y alertas del sistema" />
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
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-64" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-9 w-40" />
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Alerts list */}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-3 w-full mb-3" />
                    <Skeleton className="h-3 w-2/3 mb-3" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function getAlertIcon(tipo: string) {
  switch (tipo) {
    case "ERROR": return XCircle;
    case "WARNING": return AlertTriangle;
    case "SUCCESS": return CheckCircle2;
    default: return Info;
  }
}

function getAlertColor(tipo: string) {
  switch (tipo) {
    case "ERROR": return "text-red-600 bg-red-50 border-red-200";
    case "WARNING": return "text-amber-600 bg-amber-50 border-amber-200";
    case "SUCCESS": return "text-emerald-600 bg-emerald-50 border-emerald-200";
    default: return "text-blue-600 bg-blue-50 border-blue-200";
  }
}

function getCategoryIcon(categoria: string) {
  switch (categoria) {
    case "DOCUMENTOS": return FileText;
    case "DETRACCIONES": return Percent;
    case "IMPUESTOS": return Calendar;
    case "CUENTAS": return TrendingUp;
    case "SUNAT": return CheckCircle2;
    default: return Info;
  }
}

export default function AlertasPage() {
  const { alerts, loading, error, refetch, markAsRead, markAllAsRead } = useAlerts();
  const [filter, setFilter] = useState<"todas" | "ERROR" | "WARNING" | "INFO" | "SUCCESS">("todas");
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      const matchType = filter === "todas" || a.tipo === filter;
      const matchRead = !showOnlyUnread || !a.leida;
      return matchType && matchRead;
    });
  }, [alerts, filter, showOnlyUnread]);

  const unreadCount = alerts.filter((a) => !a.leida).length;
  const errorCount = alerts.filter((a) => a.tipo === "ERROR").length;
  const warningCount = alerts.filter((a) => a.tipo === "WARNING").length;

  async function handleMarkAsRead(alertId: string) {
    try {
      await markAsRead(alertId);
    } catch (err) {
      console.error("Error al marcar alerta como leída:", err);
    }
  }

  async function handleMarkAllAsRead() {
    try {
      setMarkingAll(true);
      await markAllAsRead();
    } catch (err) {
      console.error("Error al marcar todas las alertas como leídas:", err);
    } finally {
      setMarkingAll(false);
    }
  }

  if (loading) {
    return <AlertasSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Alertas" subtitle="Centro de notificaciones y alertas del sistema" />
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
      <Topbar title="Alertas" subtitle="Centro de notificaciones y alertas del sistema" />

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium">Total Alertas</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{alerts.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Este período</p>
          </div>
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 shadow-sm">
            <p className="text-xs text-blue-700 font-medium">No Leídas</p>
            <p className="text-xl font-bold text-blue-600 mt-1">{unreadCount}</p>
            <p className="text-xs text-blue-600 mt-0.5">Requieren atención</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-200 p-4 shadow-sm">
            <p className="text-xs text-red-700 font-medium">Críticas</p>
            <p className="text-xl font-bold text-red-600 mt-1">{errorCount}</p>
            <p className="text-xs text-red-600 mt-0.5">Acción inmediata</p>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 shadow-sm">
            <p className="text-xs text-amber-700 font-medium">Advertencias</p>
            <p className="text-xl font-bold text-amber-600 mt-1">{warningCount}</p>
            <p className="text-xs text-amber-600 mt-0.5">Revisar pronto</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as "todas" | "ERROR" | "WARNING" | "INFO" | "SUCCESS")} className="w-auto">
                <TabsList>
                  <TabsTrigger value="todas">Todas</TabsTrigger>
                  <TabsTrigger value="ERROR">Críticas</TabsTrigger>
                  <TabsTrigger value="WARNING">Advertencias</TabsTrigger>
                  <TabsTrigger value="INFO">Información</TabsTrigger>
                  <TabsTrigger value="SUCCESS">Éxito</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex items-center gap-2">
                <Button
                  variant={showOnlyUnread ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowOnlyUnread(!showOnlyUnread)}
                  className="gap-2"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Solo no leídas
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleMarkAllAsRead}
                  disabled={markingAll || unreadCount === 0}
                >
                  {markingAll ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Marcar todas leídas
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualizar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts list */}
        <div className="space-y-3">
          {filtered.map((alerta) => {
            const Icon = getAlertIcon(alerta.tipo);
            const CategoryIcon = getCategoryIcon(alerta.categoria ?? "INFO");
            const colorClass = getAlertColor(alerta.tipo);

            return (
              <Card
                key={alerta.id}
                className={`transition-all hover:shadow-md ${!alerta.leida ? "border-l-4 border-l-blue-600" : ""}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-gray-900">{alerta.titulo}</h4>
                          <Badge variant="outline" className="text-xs gap-1">
                            <CategoryIcon className="w-3 h-3" />
                            {alerta.tipo === "ERROR" ? "CRÍTICO" : 
                             alerta.tipo === "WARNING" ? "ADVERTENCIA" : 
                             alerta.tipo === "SUCCESS" ? "ÉXITO" : "INFORMACIÓN"}
                          </Badge>
                          {!alerta.leida && (
                            <span className="w-2 h-2 rounded-full bg-blue-600" title="No leída" />
                          )}
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatDateLong(alerta.fechaCreacion)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{alerta.descripcion}</p>
                      <div className="flex items-center gap-2">
                        {alerta.voucherId && (
                          <Button size="sm" variant="outline" className="gap-1.5">
                            Ver comprobante
                          </Button>
                        )}
                        {!alerta.leida && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="gap-1.5"
                            onClick={() => handleMarkAsRead(alerta.id)}
                          >
                            <Check className="w-3.5 h-3.5" />
                            Marcar leída
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filtered.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-gray-400">
                <CheckCircle2 className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">No hay alertas para mostrar</p>
                <p className="text-xs mt-1">Ajusta los filtros para ver más resultados</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
