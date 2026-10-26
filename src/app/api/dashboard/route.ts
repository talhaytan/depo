import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDashboardMetrics } from "@/lib/dashboard";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    await requireUser();
    const data = await getDashboardMetrics();
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
