import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireUser } from "@/lib/auth";
import { userUpdateSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api-error";
import { BusinessRuleError } from "@/lib/inventory";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireUser("ADMIN_ONLY");
    const { id } = await context.params;
    const body = await req.json();

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new BusinessRuleError("Kullanıcı bulunamadı.", 404);
    }

    // Prevent deactivating or demoting the last active administrator
    if (
      existing.role === "ADMIN" &&
      (body.isActive === false || body.role === "EMPLOYEE")
    ) {
      const activeAdminsCount = await prisma.user.count({
        where: { role: "ADMIN", isActive: true, id: { not: id } },
      });
      if (activeAdminsCount === 0) {
        throw new BusinessRuleError(
          "Sistemdeki tek aktif yönetici hesabı devre dışı bırakılamaz veya yetkisi düşürülemez."
        );
      }
    }

    const parsed = userUpdateSchema.parse(body);

    const emailConflict = await prisma.user.findFirst({
      where: {
        email: parsed.email.toLowerCase(),
        id: { not: id },
      },
    });
    if (emailConflict) {
      throw new BusinessRuleError(
        `"${parsed.email}" e-posta adresi başka bir kullanıcı tarafından kullanılmaktadır.`
      );
    }

    const isAdmin = parsed.role === "ADMIN";
    const updateData: Record<string, unknown> = {
      name: parsed.name,
      email: parsed.email.toLowerCase(),
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
    };

    if (parsed.password) {
      if (parsed.password.length < 6) {
        throw new BusinessRuleError("Yeni şifre en az 6 karakter olmalıdır.");
      }
      updateData.passwordHash = await hashPassword(parsed.password);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
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
        updatedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "USER_UPDATE",
        entityType: "User",
        entityId: id,
        userId: admin.id,
        summary: `${updated.name} (${updated.email}) kullanıcı ve yetki bilgileri güncellendi (Aktif: ${
          updated.isActive ? "Evet" : "Hayır"
        }, Rol: ${updated.role}).`,
        metadata: JSON.stringify({
          role: updated.role,
          isActive: updated.isActive,
          permissions: {
            canManageProducts: updated.canManageProducts,
            canManageCategories: updated.canManageCategories,
            canManageSuppliers: updated.canManageSuppliers,
            canStockIn: updated.canStockIn,
            canStockOut: updated.canStockOut,
            canAdjustStock: updated.canAdjustStock,
            canViewReports: updated.canViewReports,
            canExportData: updated.canExportData,
          },
        }),
      },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
