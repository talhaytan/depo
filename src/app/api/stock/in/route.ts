import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { stockInSchema } from "@/lib/validations";
import { performStockIn } from "@/lib/inventory";
import { handleApiError } from "@/lib/api-error";

export async function POST(req: Request) {
  try {
    const user = await requireUser("canStockIn");
    const body = await req.json();
    const parsed = stockInSchema.parse(body);

    const movement = await performStockIn({
      ...parsed,
      userId: user.id,
    });

    return NextResponse.json({ movement }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
