"use client";

import React, { useState, useEffect, useRef } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/hooks/useSession";
import { Sparkles, Send, Zap, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
}

const DEFAULT_SUGGESTIONS = [
  "Resumen ejecutivo del mes",
  "Resumen de compras del mes",
  "¿Cuáles son mis detracciones pendientes?",
  "¿Qué documentos me faltan?",
  "¿Cuánto me deben mis clientes?",
  "¿Cuánto debo pagar a mis proveedores?",
];

// Simple markdown-like renderer for bold text
function renderContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function IAPage() {
  const { session } = useSession();
  const companyId = session?.companyRoles[0]?.companyId;
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [chatHistory, setChatHistory] = useState<Message[]>([
    {
      role: "assistant",
      content: "¡Hola! Soy tu Copiloto IA. Analizo tus datos reales para darte respuestas precisas sobre compras, ventas, detracciones, alertas y más. ¿En qué puedo ayudarte hoy?",
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load context-aware suggestions
  useEffect(() => {
    const run = async () => {
      if (!companyId) return;
      try {
        const res = await fetch(`/api/ai/suggestions?companyId=${companyId}`);
        const json = await res.json();
        if (json.success && json.data.length > 0) setSuggestions(json.data);
      } catch { /* use defaults */ }
    };
    run();
  }, [companyId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  async function handleSend(text?: string) {
    const query = (text ?? message).trim();
    if (!query || sending || !companyId) return;

    setMessage("");
    setSending(true);

    setChatHistory((prev) => [
      ...prev,
      { role: "user", content: query },
      { role: "assistant", content: "", loading: true },
    ]);

    try {
      const res = await fetch("/api/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, message: query }),
      });
      const json = await res.json();
      const response = json.success ? json.data.response : "Lo siento, no pude procesar tu consulta. Intenta nuevamente.";

      setChatHistory((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: response },
      ]);
    } catch {
      setChatHistory((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "Error de conexión. Verifica tu red e intenta nuevamente." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Copiloto IA" subtitle="Asistente inteligente con datos reales" />

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Chat interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Chat */}
          <Card className="lg:col-span-2 flex flex-col" style={{ height: "600px" }}>
            <CardHeader className="pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Copiloto IA</CardTitle>
                  <p className="text-xs text-gray-500">Respuestas basadas en tus datos reales</p>
                </div>
                <Badge variant="success" className="ml-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-white mr-1.5" />
                  En línea
                </Badge>
              </div>
            </CardHeader>

            {/* Messages */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white ${msg.role === "user" ? "bg-blue-600" : "bg-gradient-to-br from-blue-600 to-violet-600"}`}>
                    {msg.role === "user"
                      ? <span className="text-xs font-bold">{session?.nombre?.substring(0, 2).toUpperCase() ?? "U"}</span>
                      : <Sparkles className="w-4 h-4" />
                    }
                  </div>
                  <div className={`flex-1 rounded-xl p-3 text-sm whitespace-pre-line ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"}`}>
                    {msg.loading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                        <span className="text-gray-500 text-xs">Analizando tus datos...</span>
                      </div>
                    ) : (
                      renderContent(msg.content)
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </CardContent>

            {/* Input */}
            <div className="p-4 border-t border-gray-100 shrink-0">
              <div className="flex gap-2">
                <Input
                  placeholder="Escribe tu consulta..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  disabled={sending || !companyId}
                  className="flex-1"
                />
                <Button onClick={() => handleSend()} disabled={sending || !message.trim() || !companyId} className="gap-2">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar
                </Button>
              </div>
            </div>
          </Card>

          {/* Suggestions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Consultas Sugeridas
              </CardTitle>
              <p className="text-xs text-gray-500">Basadas en tu situación actual</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {suggestions.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              ) : (
                suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s)}
                    disabled={sending}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-xs text-gray-700 hover:text-blue-700 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Capabilities */}
        <Card className="bg-gradient-to-br from-blue-50 to-violet-50 border-blue-200">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Capacidades del Copiloto IA</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-gray-700">
                  {[
                    ["📦 Compras", "Análisis de proveedores y comprobantes del período"],
                    ["📈 Ventas", "Resumen de ventas y top clientes"],
                    ["⚠️ Detracciones", "Estado de pagos SPOT pendientes"],
                    ["🚨 Alertas", "Alertas críticas que requieren atención"],
                    ["💰 Cuentas", "Cartera de cobros y obligaciones de pago"],
                    ["📁 Documentos", "Archivos faltantes XML, PDF y CDR"],
                  ].map(([title, desc]) => (
                    <div key={title}>
                      <p className="font-semibold mb-1">{title}</p>
                      <p className="text-gray-600">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
