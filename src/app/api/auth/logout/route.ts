import { NextResponse } from "next/server";

const TOKEN_NAME = "auth-token";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Sesión cerrada exitosamente",
  });

  // Delete cookie directly on the response
  response.cookies.set(TOKEN_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
