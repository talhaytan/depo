import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireUser } from "@/lib/auth";
import { userCreateSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api-error";
import { BusinessRuleError } from "@/lib/inventory";

export async function GET() {
  try {
    const currentUser = await requireUser();
    // All authenticated users can get a basic list of users for movement filtering,
    // while Admins get full permission details
    if (currentUser.role !== "ADMIN") {
      const basicUsers = await prisma.user.findMany({
        select: { id: true, name: true, role: true, isActive: true },
        orderBy: { name: "asc" },
      });
      return NextResponse.json({ users: basicUsers });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        canManageProducts: true,
        canManageCategories: true,
        canManageSuppliers: true,
        canStockIn: true,
        canStockOut: true,
        canAdjustStock: true,
        canViewReports: true,
        canExportData: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { movements: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireUser("ADMIN_ONLY");
    const body = await req.json();
    const parsed = userCreateSchema.parse(body);

    const existing = await prisma.user.findUnique({
      where: { email: parsed.email.toLowerCase() },
    });
    if (existing) {
      throw new BusinessRuleError(
        `"${parsed.email}" e-posta adresi ile kayıtlı bir kullanıcı zaten bulunmaktadır.`
      );
    }

    const passwordHash = await hashPassword(parsed.password);
    const isAdmin = parsed.role === "ADMIN";

    const created = await prisma.user.create({
      data: {
        name: parsed.name,
        email: parsed.email.toLowerCase(),
        passwordHash,
        role: parsed.role,
        isActive: parsed.isActive,
        canManageProducts: isAdmin || parsed.canManageProducts,
        canManageCategories: isAdmin || parsed.canManageCategories,
        canManageSuppliers: isAdmin || parsed.canManageSuppliers,
        canStockIn: isAdmin || parsed.canStockIn,
        canStockOut: isAdmin || parsed.canStockOut,
        canAdjustStock: isAdmin || parsed.canAdjustStock,
        canViewReports: isAdmin || parsed.canViewReports,
        canExportData: isAdmin || parsed.canExportData,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        canManageProducts: true,
        canManageCategories: true,
        canManageSuppliers: true,
        canStockIn: true,
        canStockOut: true,
        canAdjustStock: true,
        canViewReports: true,
        canExportData: true,
        createdAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "USER_CREATE",
        entityType: "User",
        entityId: created.id,
        userId: admin.id,
        summary: `Yeni personel hesabı oluşturuldu: ${created.name} (${created.email}) - Rol: ${created.role}.`,
      },
    });

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
