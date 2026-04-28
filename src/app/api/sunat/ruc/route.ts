import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

interface SunatRucResponse {
  success: boolean;
  data?: {
    ruc: string;
    razonSocial: string;
    nombreComercial?: string;
    estado: string;
    condicion: string;
    direccion: string;
    departamento?: string;
    provincia?: string;
    distrito?: string;
    ubigeo?: string;
    tipoContribuyente?: string;
    actividadEconomica?: string;
  };
  error?: string;
}

async function consultarRucSunat(ruc: string): Promise<SunatRucResponse> {
  try {
    // Validar formato de RUC
    if (!/^\d{11}$/.test(ruc)) {
      return {
        success: false,
        error: "RUC debe tener 11 dígitos",
      };
    }

    // Intentar con API de consulta RUC (ruc.pe)
    try {
      const response = await fetch(`https://ruc.pe/${ruc}`, {
        headers: {
          "Accept": "text/html",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (response.ok) {
        const html = await response.text();
        
        // Extraer datos del HTML (scraping básico)
        const razonSocialMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
        const direccionMatch = html.match(/Dirección[^:]*:\s*([^<]+)</i);
        const estadoMatch = html.match(/Estado[^:]*:\s*([^<]+)</i);
        
        if (razonSocialMatch) {
          return {
            success: true,
            data: {
              ruc: ruc,
              razonSocial: razonSocialMatch[1].trim(),
              nombreComercial: "",
              estado: estadoMatch ? estadoMatch[1].trim() : "ACTIVO",
              condicion: "HABIDO",
              direccion: direccionMatch ? direccionMatch[1].trim() : "",
              departamento: "",
              provincia: "",
              distrito: "",
              ubigeo: "",
              tipoContribuyente: "",
              actividadEconomica: "",
            },
          };
        }
      }
    } catch (error) {
      console.log("Error con ruc.pe:", error);
    }

    // Si no funciona ninguna API, retornar datos básicos para que el usuario complete manualmente
    return {
      success: false,
      error: "No se pudo consultar el RUC automáticamente. Por favor, ingrese los datos manualmente.",
    };
  } catch (error) {
    console.error("Error consultando RUC:", error);
    return {
      success: false,
      error: "Error al consultar RUC en SUNAT",
    };
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const ruc = searchParams.get("ruc");

    if (!ruc) {
      return NextResponse.json(
        { success: false, error: "RUC requerido" },
        { status: 400 }
      );
    }

    const result = await consultarRucSunat(ruc);

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error en endpoint RUC:", error);
    return NextResponse.json(
      { success: false, error: "Error al consultar RUC" },
      { status: 500 }
    );
  }
}
