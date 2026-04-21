"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Loader2, AlertCircle, Database } from "lucide-react";

// Sanitize error messages — never show stack traces or internal details
function sanitizeError(raw: string): { message: string; isDbError: boolean } {
  if (!raw) return { message: "Error al iniciar sesión. Intenta nuevamente.", isDbError: false };

  const lower = raw.toLowerCase();

  if (
    lower.includes("base de datos") ||
    lower.includes("database") ||
    lower.includes("p1001") ||
    lower.includes("econnrefused") ||
    lower.includes("connect") ||
    lower.includes("503")
  ) {
    return {
      message: "No se pudo conectar a la base de datos. Contacta al administrador.",
      isDbError: true,
    };
  }

  if (lower.includes("credenciales") || lower.includes("email") || lower.includes("contraseña") || lower.includes("password")) {
    return { message: raw, isDbError: false };
  }

  // Generic fallback — don't expose internals
  return { message: "Error al iniciar sesión. Intenta nuevamente.", isDbError: false };
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDbError, setIsDbError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsDbError(false);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      let data: { success: boolean; error?: string };
      try {
        data = await response.json();
      } catch {
        setError("Error de conexión. Intenta nuevamente.");
        setLoading(false);
        return;
      }

      if (!data.success) {
        const { message, isDbError: dbErr } = sanitizeError(data.error ?? "");
        setError(message);
        setIsDbError(dbErr);
        setLoading(false);
        return;
      }

      // Success — full page navigation so browser sends the new cookie on next request
      window.location.href = "/dashboard";
    } catch {
      setError("Error de conexión. Verifica tu red e intenta nuevamente.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-violet-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-lg">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">ControlSUNAT</CardTitle>
          <CardDescription>
            Plataforma Inteligente de Gestión Empresarial
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className={`flex items-start gap-2.5 p-3 rounded-lg border text-sm ${
                isDbError
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}>
                {isDbError
                  ? <Database className="w-4 h-4 mt-0.5 shrink-0" />
                  : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                }
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Email
              </label>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !email || !password}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                "Iniciar Sesión"
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs font-semibold text-blue-900 mb-2">
              Credenciales Demo:
            </p>
            <div className="space-y-1 text-xs text-blue-700">
              <p>📧 carlos.mendoza@corpandina.com</p>
              <p>🔑 password123</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
