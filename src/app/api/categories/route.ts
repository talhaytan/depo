import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { categorySchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api-error";
import { BusinessRuleError } from "@/lib/inventory";

export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("includeArchived") === "true";

    const categories = await prisma.category.findMany({
      where: includeArchived ? {} : { isArchived: false },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser("canManageCategories");
    const body = await req.json();
    const parsed = categorySchema.parse(body);

    const existing = await prisma.category.findUnique({
      where: { name: parsed.name },
    });
    if (existing) {
      throw new BusinessRuleError(
        `"${parsed.name}" adında bir kategori zaten mevcuttur.`
      );
    }

    const category = await prisma.category.create({
      data: {
        name: parsed.name,
        description: parsed.description,
      },
      include: {
        _count: { select: { products: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CATEGORY_CREATE",
        entityType: "Category",
        entityId: category.id,
        userId: user.id,
        summary: `Yeni kategori oluşturuldu: ${category.name}.`,
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
