"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Step {
  id: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
}

interface Props {
  hasCredentials: boolean;
  credentialsOk: boolean;
  hasVouchers: boolean;
}

export function OnboardingBanner({ hasCredentials, credentialsOk, hasVouchers }: Props) {
  const [dismissed, setDismissed] = useState(false);

  const steps: Step[] = [
    {
      id: "credentials",
      label: "Configurar credenciales SUNAT",
      description: "Ingresa tu RUC, Client ID, Client Secret, Usuario SOL y Clave SOL",
      href: "/configuracion",
      done: hasCredentials,
    },
    {
      id: "test",
      label: "Probar conexión SUNAT",
      description: "Verifica que las credenciales son correctas",
      href: "/configuracion",
      done: credentialsOk,
    },
    {
      id: "import",
      label: "Importar tus primeras facturas",
      description: "Sube un ZIP con tus XMLs de SUNAT o importa un CSV",
      href: "/compras",
      done: hasVouchers,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  if (dismissed || allDone) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-blue-400 hover:text-blue-600"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">{completedCount}/{steps.length}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-900 mb-3">
            Configura tu cuenta para empezar — {completedCount} de {steps.length} pasos completados
          </p>
          <div className="space-y-2">
            {steps.map((step) => (
              <Link key={step.id} href={step.href} className="flex items-center gap-3 group">
                {step.done
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  : <Circle className="w-4 h-4 text-blue-300 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${step.done ? "text-gray-400 line-through" : "text-blue-800 group-hover:text-blue-600"}`}>
                    {step.label}
                  </p>
                  {!step.done && (
                    <p className="text-xs text-blue-600">{step.description}</p>
                  )}
                </div>
                {!step.done && <ChevronRight className="w-3.5 h-3.5 text-blue-400 shrink-0 group-hover:text-blue-600" />}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
