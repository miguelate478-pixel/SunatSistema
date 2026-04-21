"use client";

import React, { useState, useEffect } from "react";
import { Bell, Search, RefreshCw, ChevronDown, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/hooks/useSession";
import Link from "next/link";

interface TopbarProps {
  title: string;
  subtitle?: string;
}

interface AlertItem {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: string;
  leida: boolean;
}

// Current period label
function currentPeriod() {
  return new Date().toLocaleDateString("es-PE", { month: "long", year: "numeric" })
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function Topbar({ title, subtitle }: TopbarProps) {
  const { session } = useSession();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const companyId = session?.companyRoles[0]?.companyId;

  useEffect(() => {
    const run = async () => {
      if (!companyId) return;
      try {
        const res = await fetch(`/api/alerts?companyId=${companyId}`);
        const json = await res.json();
        if (json.success) setAlerts(json.data.slice(0, 5));
      } catch { /* silent — topbar alerts are non-critical */ }
    };
    run();
  }, [companyId]);

  const unreadCount = alerts.filter((a) => !a.leida).length;

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      {/* Left: Title */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar comprobante, RUC..."
            className="pl-9 w-64 h-8 text-sm"
          />
        </div>

        {/* Sync button */}
        <Button variant="outline" size="sm" className="gap-2 hidden sm:flex">
          <RefreshCw className="w-3.5 h-3.5" />
          Sincronizar
        </Button>

        {/* Period selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 capitalize">
              {currentPeriod()}
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Período activo</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Array.from({ length: 4 }, (_, i) => {
              const d = new Date();
              d.setMonth(d.getMonth() - i);
              const label = d.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
              return (
                <DropdownMenuItem key={i} className="capitalize">{label}</DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notificaciones</span>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">{unreadCount} nuevas</Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {alerts.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-400">Sin notificaciones</div>
            ) : (
              alerts.map((alerta) => (
                <DropdownMenuItem key={alerta.id} className="flex flex-col items-start gap-0.5 py-2.5">
                  <div className="flex items-center gap-2 w-full">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      alerta.tipo === "ERROR" ? "bg-red-500" :
                      alerta.tipo === "WARNING" ? "bg-amber-500" :
                      alerta.tipo === "SUCCESS" ? "bg-emerald-500" : "bg-blue-500"
                    }`} />
                    <span className="text-sm font-medium text-gray-900 flex-1 truncate">{alerta.titulo}</span>
                    {!alerta.leida && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-500 pl-4 line-clamp-1">{alerta.descripcion}</p>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/alertas" className="text-center text-blue-600 text-sm font-medium justify-center w-full">
                Ver todas las alertas
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Help */}
        <Button variant="ghost" size="icon" title="Ayuda">
          <HelpCircle className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
