"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Rocket, ArrowRight } from "lucide-react";

interface OnboardingBannerProps {
  hasCredentials: boolean;
  credentialsOk: boolean;
  hasVouchers: boolean;
}

export function OnboardingBanner({ hasCredentials, credentialsOk, hasVouchers }: OnboardingBannerProps) {
  // If everything is set up, don't show the banner
  if (hasCredentials && credentialsOk && hasVouchers) {
    return null;
  }

  return (
    <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <Rocket className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              ¡Bienvenido a ControlSUNAT!
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Completa estos pasos para comenzar a sincronizar tus comprobantes electrónicos:
            </p>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm">
                {hasCredentials ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                )}
                <span className={hasCredentials ? "text-emerald-700 font-medium" : "text-gray-700"}>
                  {hasCredentials ? "Credenciales SUNAT configuradas" : "Configura tus credenciales SUNAT SOL"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {credentialsOk ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                )}
                <span className={credentialsOk ? "text-emerald-700 font-medium" : "text-gray-700"}>
                  {credentialsOk ? "Credenciales verificadas" : "Verifica tus credenciales"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {hasVouchers ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                )}
                <span className={hasVouchers ? "text-emerald-700 font-medium" : "text-gray-700"}>
                  {hasVouchers ? "Comprobantes sincronizados" : "Sincroniza tus primeros comprobantes"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!hasCredentials && (
                <Link href="/configuracion">
                  <Button size="sm" className="gap-2">
                    Configurar credenciales <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              )}
              {hasCredentials && !hasVouchers && (
                <Link href="/descargas">
                  <Button size="sm" className="gap-2">
                    Sincronizar ahora <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
