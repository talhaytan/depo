import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { stockOutSchema } from "@/lib/validations";
import { performStockOut } from "@/lib/inventory";
import { handleApiError } from "@/lib/api-error";

export async function POST(req: Request) {
  try {
    const user = await requireUser("canStockOut");
    const body = await req.json();
    const parsed = stockOutSchema.parse(body);

    const movement = await performStockOut({
      ...parsed,
      userId: user.id,
    });

    return NextResponse.json({ movement }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
