"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Edit2, CheckCircle2, AlertTriangle, Loader2, X, Save, Eye, EyeOff } from "lucide-react";

interface UserItem {
  id: string;
  email: string;
  nombre: string;
  isActive: boolean;
  createdAt: string;
  companyRoles: Array<{
    companyId: string;
    company: { razonSocial: string; nombreComercial?: string | null; ruc: string };
    role: { name: string };
  }>;
}

interface Company {
  id: string;
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
}

const ROLES = ["ADMIN_EMPRESA", "CONTABILIDAD", "TESORERIA", "GERENCIA", "AUDITOR"] as const;
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN_EMPRESA: "Admin Empresa",
  CONTABILIDAD: "Contabilidad",
  TESORERIA: "Tesorería",
  GERENCIA: "Gerencia",
  AUDITOR: "Auditor",
};

function CreateUserForm({
  companies,
  onSave,
  onCancel,
  saving,
}: {
  companies: Company[];
  onSave: (data: Record<string, string>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [roleName, setRoleName] = useState("CONTABILIDAD");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ nombre, email, password, companyId, roleName });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Nombre *</label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre completo" required disabled={saving} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Email *</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@empresa.com" required disabled={saving} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Contraseña *</label>
          <div className="relative">
            <Input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
              minLength={8}
              disabled={saving}
              className="pr-10"
            />
            <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Empresa *</label>
          <Select value={companyId} onValueChange={setCompanyId} disabled={saving}>
            <SelectTrigger><SelectValue placeholder="Seleccionar empresa" /></SelectTrigger>
            <SelectContent>
              {companies.map((co) => (
                <SelectItem key={co.id} value={co.id}>
                  {co.nombreComercial ?? co.razonSocial} ({co.ruc})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Rol *</label>
          <Select value={roleName} onValueChange={setRoleName} disabled={saving}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? "Creando..." : "Crear usuario"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          <X className="w-3.5 h-3.5 mr-1" />Cancelar
        </Button>
      </div>
    </form>
  );
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, companiesRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/companies"),
      ]);
      const [usersJson, companiesJson] = await Promise.all([usersRes.json(), companiesRes.json()]);
      if (usersJson.success) setUsers(usersJson.data);
      if (companiesJson.success) setCompanies(companiesJson.data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(data: Record<string, string>) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        setMsg({ ok: true, text: json.message });
        setShowCreate(false);
        load();
      } else {
        setMsg({ ok: false, text: json.error });
      }
    } catch {
      setMsg({ ok: false, text: "Error de conexión" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: UserItem) {
    setTogglingId(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      const json = await res.json();
      if (json.success) load();
    } catch { /* silent */ } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Usuarios" subtitle="Gestión de usuarios y roles" />
      <div className="flex-1 overflow-auto p-6 space-y-5 max-w-4xl">

        {msg && (
          <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${msg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>
            {msg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            {msg.text}
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">{users.length} usuario(s)</h2>
          <Button size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" />Nuevo Usuario
          </Button>
        </div>

        {showCreate && (
          <CreateUserForm companies={companies} onSave={handleCreate} onCancel={() => setShowCreate(false)} saving={saving} />
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Users className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No hay usuarios registrados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <Card key={user.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {user.nombre.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{user.nombre}</p>
                        <Badge variant={user.isActive ? "success" : "secondary"} className="text-xs">
                          {user.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                        {user.companyRoles.map((cr, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {ROLE_LABELS[cr.role.name] ?? cr.role.name} · {cr.company.nombreComercial ?? cr.company.razonSocial}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActive(user)}
                      disabled={togglingId === user.id}
                      className="shrink-0"
                    >
                      {togglingId === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (user.isActive ? "Desactivar" : "Activar")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
