import { NextResponse } from "next/server";
import { AuthorizationError } from "./auth";
import { BusinessRuleError } from "./inventory";
import { ZodError } from "zod";

export function handleApiError(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    );
  }

  if (error instanceof BusinessRuleError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    );
  }

  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return NextResponse.json(
      {
        error: firstIssue?.message || "Geçersiz form verisi gönderildi.",
        issues: error.issues,
      },
      { status: 400 }
    );
  }

  console.error("API Error:", error);
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "İşlem sırasında beklenmeyen bir sunucu hatası oluştu.",
    },
    { status: 500 }
  );
}
