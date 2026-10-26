import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { stockReverseSchema } from "@/lib/validations";
import { performMovementReversal } from "@/lib/inventory";
import { handleApiError } from "@/lib/api-error";

export async function POST(req: Request) {
  try {
    const user = await requireUser("canAdjustStock");
    const body = await req.json();
    const parsed = stockReverseSchema.parse(body);

    const movement = await performMovementReversal({
      ...parsed,
      userId: user.id,
    });

    return NextResponse.json({ movement }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
