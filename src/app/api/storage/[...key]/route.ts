import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { storage } from "@/lib/storage";

/**
 * Serves local storage files with auth protection.
 * In production with S3, this route is not needed — files are served directly from S3.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    await requireAuth();
    const { key } = await params;
    const storageKey = key.join("/");

    const buffer = await storage.get(storageKey);

    // Determine content type from extension
    const ext = storageKey.split(".").pop()?.toLowerCase() ?? "";
    const mimeTypes: Record<string, string> = {
      xml: "application/xml",
      pdf: "application/pdf",
      json: "application/json",
      csv: "text/csv",
    };
    const contentType = mimeTypes[ext] ?? "application/octet-stream";

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${key[key.length - 1]}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Archivo no encontrado";
    if (msg === "No autenticado") {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Archivo no encontrado" }, { status: 404 });
  }
}
