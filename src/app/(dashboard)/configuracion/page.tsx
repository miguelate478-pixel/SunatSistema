"use client";

import React, { useState, useEffect } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveCompany } from "@/lib/hooks/useActiveCompany";
import {
  Shield, CheckCircle2, XCircle, Loader2, Eye, EyeOff,
  RefreshCw, Save, AlertTriangle, Wifi, WifiOff, Clock,
} from "lucide-react";

interface SunatCredStatus {
  id: string;
  ruc: string;
  clientId: string;
  usuarioSol: string;
  isActive: boolean;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
  lastSyncAt: string | null;
}

export default function ConfiguracionPage() {
  const { activeCompany } = useActiveCompany();
  const companyId = activeCompany?.id;

  const [cred, setCred] = useState<SunatCredStatus | null>(null);
  const [loadingCred, setLoadingCred] = useState(true);

  // Form state
  const [ruc, setRuc] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [lookingUpRuc, setLookingUpRuc] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [usuarioSol, setUsuarioSol] = useState("");
  const [claveSol, setClaveSol] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showClave, setShowClave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Test state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ connected: boolean; message: string } | null>(null);

  // Load existing credentials
  useEffect(() => {
    const run = async () => {
      if (!companyId) return;
      setLoadingCred(true);
      try {
        const res = await fetch(`/api/sunat/credentials?companyId=${companyId}`);
        const json = await res.json();
        if (json.success && json.data) {
          setCred(json.data);
          setRuc(json.data.ruc);
          setClientId(json.data.clientId);
          setUsuarioSol(json.data.usuarioSol ?? "");
        } else {
          setCred(null);
          setRuc(activeCompany?.ruc ?? "");
          setClientId("");
          setUsuarioSol("");
        }
      } catch { /* silent */ } finally {
        setLoadingCred(false);
      }
    };
    run();
  }, [companyId, activeCompany?.ruc]);

  // Auto-lookup RUC
  useEffect(() => {
    if (ruc.length !== 11) return;
    let cancelled = false;
    const lookup = async () => {
      setLookingUpRuc(true);
      try {
        const res = await fetch(`/api/sunat/ruc?ruc=${ruc}&companyId=${companyId ?? ""}`);
        const json = await res.json();
        if (!cancelled && json.success) setRazonSocial(json.data.razonSocial);
        else if (!cancelled) setRazonSocial("");
      } catch {
        if (!cancelled) setRazonSocial("");
      } finally {
        if (!cancelled) setLookingUpRuc(false);
      }
    };
    const timer = setTimeout(lookup, 500);
    return () => { cancelled = true; clearTimeout(timer); setRazonSocial(""); setLookingUpRuc(false); };
  }, [ruc, companyId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/sunat/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, ruc, clientId, clientSecret, usuario: usuarioSol, claveSol }),
      });
      const json = await res.json();
      if (json.success) {
        setSaveMsg({ ok: true, text: "Credenciales guardadas correctamente" });
        setClientSecret("");
        setClaveSol("");
        setTestResult(null);
        const r2 = await fetch(`/api/sunat/credentials?companyId=${companyId}`);
        const j2 = await r2.json();
        if (j2.success && j2.data) setCred(j2.data);
      } else {
        setSaveMsg({ ok: false, text: json.error ?? "Error al guardar" });
      }
    } catch {
      setSaveMsg({ ok: false, text: "Error de conexión" });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!companyId) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/sunat/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const json = await res.json();
      if (json.success) {
        setTestResult(json.data);
        const r2 = await fetch(`/api/sunat/credentials?companyId=${companyId}`);
        const j2 = await r2.json();
        if (j2.success && j2.data) setCred(j2.data);
      } else {
        setTestResult({ connected: false, message: json.error ?? "Error al probar conexión" });
      }
    } catch {
      setTestResult({ connected: false, message: "Error de conexión" });
    } finally {
      setTesting(false);
    }
  }

  const connectionStatus = cred?.lastTestOk === true ? "connected"
    : cred?.lastTestOk === false ? "failed"
    : "unknown";

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Configuración" subtitle="Conexión SUNAT y ajustes de empresa" />

      <div className="flex-1 overflow-auto p-6 space-y-5 max-w-3xl">

        {/* Connection status banner */}
        {!loadingCred && cred && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
            connectionStatus === "connected" ? "bg-emerald-50 border-emerald-200" :
            connectionStatus === "failed" ? "bg-red-50 border-red-200" :
            "bg-gray-50 border-gray-200"
          }`}>
            {connectionStatus === "connected" && <Wifi className="w-4 h-4 text-emerald-600 shrink-0" />}
            {connectionStatus === "failed" && <WifiOff className="w-4 h-4 text-red-600 shrink-0" />}
            {connectionStatus === "unknown" && <Clock className="w-4 h-4 text-gray-500 shrink-0" />}
            <div className="flex-1">
              <p className={`text-sm font-semibold ${
                connectionStatus === "connected" ? "text-emerald-800" :
                connectionStatus === "failed" ? "text-red-800" : "text-gray-700"
              }`}>
                {connectionStatus === "connected" ? "Conexión SUNAT activa" :
                 connectionStatus === "failed" ? "Conexión SUNAT fallida" :
                 "Conexión SUNAT no probada"}
              </p>
              {cred.lastTestMessage && <p className="text-xs text-gray-600 mt-0.5">{cred.lastTestMessage}</p>}
              {cred.lastTestedAt && <p className="text-xs text-gray-400 mt-0.5">Última prueba: {new Date(cred.lastTestedAt).toLocaleString("es-PE")}</p>}
              {cred.lastSyncAt && <p className="text-xs text-gray-400">Última sincronización: {new Date(cred.lastSyncAt).toLocaleString("es-PE")}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing} className="gap-2 shrink-0">
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Probar conexión
            </Button>
          </div>
        )}

        {/* Test result */}
        {testResult && (
          <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
            testResult.connected ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
          }`}>
            {testResult.connected
              ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              : <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
            <div>
              <p className={`text-sm font-semibold ${testResult.connected ? "text-emerald-800" : "text-red-800"}`}>
                {testResult.connected ? "Conexión exitosa" : "Conexión fallida"}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">{testResult.message}</p>
            </div>
          </div>
        )}

        {/* Credentials form */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">Credenciales SUNAT</CardTitle>
                <CardDescription className="text-xs">
                  Credenciales OAuth2 del API CPE de SUNAT. Todos los secretos se cifran con AES-256.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingCred ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                {/* Company info */}
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 font-medium">Empresa activa</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">
                    {activeCompany?.nombreComercial ?? activeCompany?.razonSocial ?? "—"}
                  </p>
                </div>

                {/* RUC */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">RUC de la empresa</label>
                  <Input
                    value={ruc}
                    onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="RUC de 11 dígitos"
                    maxLength={11}
                    required
                    disabled={saving}
                  />
                  {lookingUpRuc && <p className="text-xs text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Buscando razón social...</p>}
                  {razonSocial && !lookingUpRuc && <p className="text-xs text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {razonSocial}</p>}
                </div>

                {/* Client ID */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Client ID</label>
                  <Input
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value.trim())}
                    placeholder="Tu client_id de SUNAT"
                    required
                    disabled={saving}
                  />
                  <p className="text-xs text-gray-400">Obtenido en <a href="https://cpe.sunat.gob.pe" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">cpe.sunat.gob.pe</a> → Mis aplicaciones</p>
                </div>

                {/* Client Secret */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Client Secret
                    {cred && <span className="ml-2 text-xs text-gray-400 font-normal">(dejar vacío para mantener el actual)</span>}
                  </label>
                  <div className="relative">
                    <Input
                      type={showSecret ? "text" : "password"}
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder={cred ? "••••••••••••••••" : "Tu client_secret de SUNAT"}
                      required={!cred}
                      disabled={saving}
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Credenciales SOL (usuario y clave SUNAT)</p>

                  {/* Usuario SOL */}
                  <div className="space-y-1.5 mb-4">
                    <label className="text-sm font-medium text-gray-700">Usuario SOL</label>
                    <Input
                      value={usuarioSol}
                      onChange={(e) => setUsuarioSol(e.target.value.trim().toUpperCase())}
                      placeholder="Ej: MODDATOS o tu usuario SOL"
                      required
                      disabled={saving}
                    />
                    <p className="text-xs text-gray-400">
                      Solo el usuario, sin el RUC. El sistema lo concatena automáticamente. Ej: si tu usuario SOL es <code className="bg-gray-100 px-1 rounded">20610169849SHERMAN</code>, ingresa solo <code className="bg-gray-100 px-1 rounded">SHERMAN</code>
                    </p>
                  </div>

                  {/* Clave SOL */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      Clave SOL
                      {cred && <span className="ml-2 text-xs text-gray-400 font-normal">(dejar vacío para mantener la actual)</span>}
                    </label>
                    <div className="relative">
                      <Input
                        type={showClave ? "text" : "password"}
                        value={claveSol}
                        onChange={(e) => setClaveSol(e.target.value)}
                        placeholder={cred ? "••••••••••••••••" : "Tu clave SOL de SUNAT"}
                        required={!cred}
                        disabled={saving}
                        className="pr-10"
                      />
                      <button type="button" onClick={() => setShowClave(!showClave)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showClave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400">Se cifra con AES-256 antes de guardarse.</p>
                  </div>
                </div>

                {saveMsg && (
                  <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
                    saveMsg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"
                  }`}>
                    {saveMsg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    {saveMsg.text}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={saving || !companyId} className="gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? "Guardando..." : "Guardar credenciales"}
                  </Button>
                  {cred && (
                    <Button type="button" variant="outline" onClick={handleTest} disabled={testing || !companyId} className="gap-2">
                      {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                      {testing ? "Probando..." : "Probar conexión"}
                    </Button>
                  )}
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Status summary */}
        {cred && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Estado de integración SUNAT</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">RUC</span>
                <Badge variant="success">{cred.ruc}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Client ID</span>
                <span className="text-xs font-mono text-gray-700">{cred.clientId.slice(0, 8)}…</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Usuario SOL</span>
                <span className="text-xs font-mono text-gray-700">{cred.ruc}{cred.usuarioSol}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Estado conexión</span>
                <Badge variant={connectionStatus === "connected" ? "success" : connectionStatus === "failed" ? "destructive" : "secondary"}>
                  {connectionStatus === "connected" ? "Conectado" : connectionStatus === "failed" ? "Error" : "Sin probar"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800 space-y-1">
                <p className="font-semibold">Cómo obtener credenciales SUNAT</p>
                <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
                  <li>Ingresa a <a href="https://cpe.sunat.gob.pe" target="_blank" rel="noopener noreferrer" className="underline">cpe.sunat.gob.pe</a> con tu clave SOL</li>
                  <li>Ve a &quot;Mis aplicaciones&quot; → &quot;Nueva aplicación&quot;</li>
                  <li>Selecciona el scope: <code className="bg-blue-100 px-1 rounded">https://api-cpe.sunat.gob.pe</code></li>
                  <li>Copia el <strong>client_id</strong> y <strong>client_secret</strong> generados</li>
                  <li>El <strong>Usuario SOL</strong> y <strong>Clave SOL</strong> son los mismos que usas para ingresar a SUNAT</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
