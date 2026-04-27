"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Edit2, CheckCircle2, AlertTriangle, Loader2, X, Save } from "lucide-react";

interface Company {
  id: string;
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  sector: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
  _count: { vouchers: number; userRoles: number };
}

function CompanyForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<Company>;
  onSave: (data: Record<string, string>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [ruc, setRuc] = useState(initial?.ruc ?? "");
  const [razonSocial, setRazonSocial] = useState(initial?.razonSocial ?? "");
  const [nombreComercial, setNombreComercial] = useState(initial?.nombreComercial ?? "");
  const [sector, setSector] = useState(initial?.sector ?? "Comercio");
  const [plan, setPlan] = useState(initial?.plan ?? "PROFESSIONAL");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ ruc, razonSocial, nombreComercial, sector, plan });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">RUC *</label>
          <Input
            value={ruc}
            onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 11))}
            placeholder="20xxxxxxxxx"
            maxLength={11}
            required
            disabled={!!initial?.id || saving}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Razón Social *</label>
          <Input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} placeholder="EMPRESA S.A.C." required disabled={saving} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Nombre Comercial</label>
          <Input value={nombreComercial} onChange={(e) => setNombreComercial(e.target.value)} placeholder="Nombre corto" disabled={saving} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Sector</label>
          <Input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Comercio" disabled={saving} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Plan</label>
          <Select value={plan} onValueChange={setPlan} disabled={saving}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="STARTER">Starter</SelectItem>
              <SelectItem value="PROFESSIONAL">Professional</SelectItem>
              <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? "Guardando..." : "Guardar"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          <X className="w-3.5 h-3.5 mr-1" />Cancelar
        </Button>
      </div>
    </form>
  );
}

export default function EmpresasPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/companies");
      const json = await res.json();
      if (json.success) setCompanies(json.data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/companies");
        const json = await res.json();
        if (json.success) setCompanies(json.data);
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  async function handleCreate(data: Record<string, string>) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/companies", {
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

  async function handleEdit(id: string, data: Record<string, string>) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        setMsg({ ok: true, text: json.message });
        setEditId(null);
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

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Empresas" subtitle="Gestión de empresas registradas" />
      <div className="flex-1 overflow-auto p-6 space-y-5 max-w-4xl">

        {msg && (
          <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${msg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>
            {msg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            {msg.text}
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">{companies.length} empresa(s) registrada(s)</h2>
          <Button size="sm" className="gap-2" onClick={() => { setShowCreate(true); setEditId(null); }}>
            <Plus className="w-3.5 h-3.5" />Nueva Empresa
          </Button>
        </div>

        {showCreate && (
          <CompanyForm onSave={handleCreate} onCancel={() => setShowCreate(false)} saving={saving} />
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Building2 className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No hay empresas registradas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {companies.map((co) => (
              <Card key={co.id}>
                <CardContent className="p-4">
                  {editId === co.id ? (
                    <CompanyForm
                      initial={co}
                      onSave={(data) => handleEdit(co.id, data)}
                      onCancel={() => setEditId(null)}
                      saving={saving}
                    />
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {co.nombreComercial ?? co.razonSocial}
                          </p>
                          <Badge variant={co.isActive ? "success" : "secondary"} className="text-xs">
                            {co.isActive ? "Activa" : "Inactiva"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{co.plan}</Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{co.razonSocial} · RUC: {co.ruc}</p>
                        <p className="text-xs text-gray-400">{co._count.vouchers} comprobantes · {co._count.userRoles} usuarios · {co.sector}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="gap-1.5 shrink-0" onClick={() => { setEditId(co.id); setShowCreate(false); }}>
                        <Edit2 className="w-3.5 h-3.5" />Editar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
