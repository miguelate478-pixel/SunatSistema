"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, X, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  companyId: string;
  companyRuc: string;
  mode: "COMPRA" | "VENTA"; // determines which RUC is pre-filled
  onCreated: () => void;
}

export function NuevoComprobanteModal({ open, onClose, companyId, companyRuc, mode, onCreated }: Props) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [tipo, setTipo] = useState("FACTURA");
  const [serie, setSerie] = useState("");
  const [numero, setNumero] = useState("");
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split("T")[0]);
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [rucEmisor, setRucEmisor] = useState(mode === "VENTA" ? companyRuc : "");
  const [razonSocialEmisor, setRazonSocialEmisor] = useState(mode === "VENTA" ? "" : "");
  const [rucReceptor, setRucReceptor] = useState(mode === "COMPRA" ? companyRuc : "");
  const [razonSocialReceptor, setRazonSocialReceptor] = useState(mode === "COMPRA" ? "" : "");
  const [moneda, setMoneda] = useState("PEN");
  const [subtotal, setSubtotal] = useState("");
  const [igv, setIgv] = useState("");
  const [total, setTotal] = useState("");
  const [estado, setEstado] = useState("ACEPTADO");
  const [afectoDetraccion, setAfectoDetraccion] = useState(false);
  const [porcentajeDetraccion, setPorcentajeDetraccion] = useState("12");

  // Auto-calculate IGV and total from subtotal
  function handleSubtotalChange(val: string) {
    setSubtotal(val);
    const sub = parseFloat(val) || 0;
    const igvCalc = Math.round(sub * 0.18 * 100) / 100;
    setIgv(String(igvCalc));
    setTotal(String(Math.round((sub + igvCalc) * 100) / 100));
  }

  function handleTotalChange(val: string) {
    setTotal(val);
    const tot = parseFloat(val) || 0;
    const sub = Math.round((tot / 1.18) * 100) / 100;
    const igvCalc = Math.round((tot - sub) * 100) / 100;
    setSubtotal(String(sub));
    setIgv(String(igvCalc));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          tipo,
          serie: serie.trim().toUpperCase(),
          numero: numero.trim(),
          fechaEmision,
          fechaVencimiento: fechaVencimiento || undefined,
          rucEmisor: rucEmisor.trim(),
          razonSocialEmisor: razonSocialEmisor.trim(),
          rucReceptor: rucReceptor.trim(),
          razonSocialReceptor: razonSocialReceptor.trim(),
          moneda,
          subtotal: parseFloat(subtotal) || 0,
          igv: parseFloat(igv) || 0,
          total: parseFloat(total) || 0,
          estado,
          afectoDetraccion,
          porcentajeDetraccion: afectoDetraccion ? parseFloat(porcentajeDetraccion) : undefined,
          montoDetraccion: afectoDetraccion ? Math.round(parseFloat(total) * (parseFloat(porcentajeDetraccion) / 100) * 100) / 100 : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMsg({ ok: true, text: json.message });
        onCreated();
        setTimeout(() => { onClose(); }, 1200);
      } else {
        setMsg({ ok: false, text: json.error ?? "Error al guardar" });
      }
    } catch {
      setMsg({ ok: false, text: "Error de conexión" });
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {mode === "COMPRA" ? "Registrar Comprobante de Compra" : "Registrar Comprobante de Venta"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {/* Tipo + Serie + Número */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Tipo *</label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FACTURA">Factura</SelectItem>
                  <SelectItem value="BOLETA">Boleta</SelectItem>
                  <SelectItem value="NOTA_CREDITO">Nota de Crédito</SelectItem>
                  <SelectItem value="NOTA_DEBITO">Nota de Débito</SelectItem>
                  <SelectItem value="RECIBO">Recibo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Serie *</label>
              <Input value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="F001" required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Número *</label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="00012345" required />
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Fecha de Emisión *</label>
              <Input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Fecha de Vencimiento</label>
              <Input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
            </div>
          </div>

          {/* Emisor */}
          <div className="p-3 bg-gray-50 rounded-lg space-y-3">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Emisor</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">RUC Emisor *</label>
                <Input value={rucEmisor} onChange={(e) => setRucEmisor(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="20xxxxxxxxx" maxLength={11} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Razón Social Emisor *</label>
                <Input value={razonSocialEmisor} onChange={(e) => setRazonSocialEmisor(e.target.value)} placeholder="Nombre del emisor" required />
              </div>
            </div>
          </div>

          {/* Receptor */}
          <div className="p-3 bg-gray-50 rounded-lg space-y-3">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Receptor</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">RUC Receptor *</label>
                <Input value={rucReceptor} onChange={(e) => setRucReceptor(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="20xxxxxxxxx" maxLength={11} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Razón Social Receptor *</label>
                <Input value={razonSocialReceptor} onChange={(e) => setRazonSocialReceptor(e.target.value)} placeholder="Nombre del receptor" required />
              </div>
            </div>
          </div>

          {/* Montos */}
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Moneda</label>
              <Select value={moneda} onValueChange={setMoneda}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PEN">PEN (S/)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Subtotal *</label>
              <Input type="number" step="0.01" value={subtotal} onChange={(e) => handleSubtotalChange(e.target.value)} placeholder="0.00" required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">IGV (18%)</label>
              <Input type="number" step="0.01" value={igv} onChange={(e) => setIgv(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Total *</label>
              <Input type="number" step="0.01" value={total} onChange={(e) => handleTotalChange(e.target.value)} placeholder="0.00" required />
            </div>
          </div>

          {/* Estado + Detracción */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Estado</label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACEPTADO">Aceptado</SelectItem>
                  <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                  <SelectItem value="OBSERVADO">Observado</SelectItem>
                  <SelectItem value="RECHAZADO">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Detracción</label>
              <div className="flex items-center gap-2 h-10">
                <input
                  type="checkbox"
                  id="detraccion"
                  checked={afectoDetraccion}
                  onChange={(e) => setAfectoDetraccion(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="detraccion" className="text-sm text-gray-700">Afecto a detracción</label>
                {afectoDetraccion && (
                  <Select value={porcentajeDetraccion} onValueChange={setPorcentajeDetraccion}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4%</SelectItem>
                      <SelectItem value="10">10%</SelectItem>
                      <SelectItem value="12">12%</SelectItem>
                      <SelectItem value="15">15%</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>

          {msg && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {msg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              {msg.text}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving} className="gap-2 flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Guardando..." : "Guardar comprobante"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
