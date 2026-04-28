"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ShoppingCart, TrendingUp, Percent, FolderOpen,
  AlertTriangle, BarChart3, Sparkles, CreditCard, Wallet, Download,
  Settings, ChevronLeft, ChevronRight, Building2, LogOut, Check,
  Users, FileText, KeyRound, X, Eye, EyeOff, Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/hooks/useSession";
import { useActiveCompany } from "@/lib/hooks/useActiveCompany";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  badgeVariant?: "default" | "destructive" | "warning" | "success";
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compras", label: "Compras", icon: ShoppingCart },
  { href: "/ventas", label: "Ventas", icon: TrendingUp },
  { href: "/detracciones", label: "Detracciones", icon: Percent },
  { href: "/documentos", label: "Documentos", icon: FolderOpen },
  { href: "/alertas", label: "Alertas", icon: AlertTriangle },
  { href: "/cuentas-cobrar", label: "Cuentas x Cobrar", icon: CreditCard },
  { href: "/cuentas-pagar", label: "Cuentas x Pagar", icon: Wallet },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/ia", label: "Copiloto IA", icon: Sparkles },
];

const bottomNavItems: NavItem[] = [
  { href: "/descargas", label: "Descargas SUNAT", icon: Download },
  { href: "/sire", label: "SIRE (RCE/RVIE)", icon: FileText },
  { href: "/admin/empresas", label: "Empresas", icon: Building2 },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { session, logout } = useSession();
  const { activeCompany, setActiveCompany, allCompanies } = useActiveCompany();
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingPwd, setSavingPwd] = useState(false);

  async function handleChangePwd(e: React.FormEvent) {
    e.preventDefault();
    setSavingPwd(true);
    setPwdMsg(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const json = await res.json();
      if (json.success) {
        setPwdMsg({ ok: true, text: "Contraseña actualizada correctamente" });
        setCurrentPwd(""); setNewPwd("");
        setTimeout(() => { setShowChangePwd(false); setPwdMsg(null); }, 1500);
      } else {
        setPwdMsg({ ok: false, text: json.error });
      }
    } catch {
      setPwdMsg({ ok: false, text: "Error de conexión" });
    } finally {
      setSavingPwd(false);
    }
  }

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen bg-gray-950 text-white transition-all duration-300 ease-in-out border-r border-gray-800",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-16 px-4 border-b border-gray-800 shrink-0",
        collapsed ? "justify-center" : "gap-3"
      )}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 shrink-0">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white leading-tight truncate">ControlSUNAT</p>
            <p className="text-xs text-gray-400 truncate">Plataforma Empresarial</p>
          </div>
        )}
      </div>

      {/* Company selector */}
      {!collapsed && session && (
        <div className="px-3 py-3 border-b border-gray-800 shrink-0">
          {allCompanies.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-2 px-2 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors text-left">
                  <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {(activeCompany?.razonSocial ?? "CA").substring(0, 2).toUpperCase()}
                  </div>
                  <div className="overflow-hidden flex-1">
                    <p className="text-xs font-medium text-white truncate">
                      {activeCompany?.nombreComercial ?? activeCompany?.razonSocial ?? "Empresa"}
                    </p>
                    <p className="text-xs text-gray-400 truncate">RUC: {activeCompany?.ruc ?? "—"}</p>
                  </div>
                  <ChevronRight className="w-3 h-3 text-gray-500 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-64">
                <DropdownMenuLabel>Cambiar empresa</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {allCompanies.map((co) => (
                  <DropdownMenuItem key={co.id} onClick={() => setActiveCompany(co)} className="gap-2">
                    <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {co.razonSocial.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{co.nombreComercial ?? co.razonSocial}</p>
                      <p className="text-xs text-gray-500">RUC: {co.ruc}</p>
                    </div>
                    {activeCompany?.id === co.id && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-gray-900">
              <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {(activeCompany?.razonSocial ?? "CA").substring(0, 2).toUpperCase()}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-xs font-medium text-white truncate">
                  {activeCompany?.nombreComercial ?? activeCompany?.razonSocial ?? "Empresa"}
                </p>
                <p className="text-xs text-gray-400 truncate">RUC: {activeCompany?.ruc ?? "—"}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3">
        <nav className="px-2 space-y-0.5">
          {!collapsed && (
            <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Principal
            </p>
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all duration-150 group relative",
                  collapsed ? "justify-center" : "",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={cn("shrink-0", collapsed ? "w-5 h-5" : "w-4 h-4")} />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <Badge
                        variant={item.badgeVariant || "default"}
                        className="text-xs px-1.5 py-0 h-5 min-w-[20px] flex items-center justify-center"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
                {collapsed && item.badge && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                )}
              </Link>
            );
          })}

          {!collapsed && (
            <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4 mb-1">
              Sistema
            </p>
          )}
          {!collapsed && <Separator className="bg-gray-800 my-2" />}
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all duration-150",
                  collapsed ? "justify-center" : "",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={cn("shrink-0", collapsed ? "w-5 h-5" : "w-4 h-4")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Bottom user section */}
      <div className={cn(
        "border-t border-gray-800 p-3 shrink-0",
        collapsed ? "flex justify-center" : ""
      )}>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {session?.nombre?.substring(0, 2).toUpperCase() || "CM"}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-medium text-white truncate">{session?.nombre || "Carlos Mendoza"}</p>
              <p className="text-xs text-gray-400 truncate">
                {session?.companyRoles[0]?.roleName || "Admin Empresa"}
              </p>
            </div>
            <button 
              onClick={logout}
              className="text-gray-500 hover:text-white transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowChangePwd(true)}
              className="text-gray-500 hover:text-white transition-colors"
              title="Cambiar contraseña"
            >
              <KeyRound className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button 
            onClick={logout}
            className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white cursor-pointer"
            title="Cerrar sesión"
          >
            {session?.nombre?.substring(0, 2).toUpperCase() || "CM"}
          </button>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-all z-10"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>

      {/* Change password modal */}
      {showChangePwd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Cambiar contraseña</h2>
              <button onClick={() => { setShowChangePwd(false); setPwdMsg(null); setCurrentPwd(""); setNewPwd(""); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleChangePwd} className="p-5 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Contraseña actual</label>
                <div className="relative">
                  <Input type={showPwd ? "text" : "password"} value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} required disabled={savingPwd} className="pr-9" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Nueva contraseña</label>
                <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required minLength={8} disabled={savingPwd} placeholder="Mínimo 8 caracteres" />
              </div>
              {pwdMsg && (
                <p className={`text-xs ${pwdMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{pwdMsg.text}</p>
              )}
              <Button type="submit" size="sm" className="w-full gap-2" disabled={savingPwd}>
                {savingPwd ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                {savingPwd ? "Guardando..." : "Actualizar contraseña"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}
