import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ControlSUNAT - Plataforma Inteligente de Gestión Empresarial",
  description: "Sistema web SaaS multiempresa para control de facturas electrónicas, detracciones, reportes y gestión tributaria",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
