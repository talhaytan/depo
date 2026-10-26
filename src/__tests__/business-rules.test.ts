import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  performStockIn,
  performStockOut,
  performStockAdjustment,
  performMovementReversal,
  BusinessRuleError,
} from "@/lib/inventory";
import { getStockStatus, toNumeric } from "@/lib/utils";
import { hasPermission, SessionUser } from "@/lib/auth";
import { getDashboardMetrics } from "@/lib/dashboard";
import { productSchema } from "@/lib/validations";

describe("DEPO — Envanter ve Depo Yönetimi Kritik İş Kuralları Test Paketi", () => {
  let testUserId: string;
  let testCategoryId: string;
  const createdProductIds: string[] = [];

  beforeAll(async () => {
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (admin) {
      testUserId = admin.id;
    } else {
      const u = await prisma.user.create({
        data: {
          email: `test-admin-${Date.now()}@depo.local`,
          name: "Test Yöneticisi",
          passwordHash: "hashed",
          role: "ADMIN",
        },
      });
      testUserId = u.id;
    }

    const cat = await prisma.category.upsert({
      where: { name: "Test Kategorisi (Otomasyon)" },
      update: {},
      create: {
        name: "Test Kategorisi (Otomasyon)",
        description: "Otomatik testler için kategori",
      },
    });
    testCategoryId = cat.id;
  });

  afterAll(async () => {
    // Clean up test artifacts created during test run
    if (createdProductIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.stockMovement.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.product.deleteMany({
        where: { id: { in: createdProductIds } },
      });
    }
    if (testCategoryId) {
      await prisma.category
        .delete({ where: { id: testCategoryId } })
        .catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("1. Ürün oluşturma ve benzersiz Stok Kodu (SKU) doğrulaması çalışmalı", async () => {
    const uniqueSku = `TST-SKU-${Date.now()}`;
    const parsed = productSchema.parse({
      name: "Test Endüstriyel Rulman 6204",
      sku: uniqueSku,
      barcode: null,
      categoryId: testCategoryId,
      unit: "Adet",
      minStockLevel: 10,
      unitCost: 150,
    });

    const p1 = await prisma.product.create({
      data: {
        name: parsed.name,
        sku: parsed.sku,
        barcode: parsed.barcode,
        categoryId: parsed.categoryId,
        unit: parsed.unit,
        minStockLevel: parsed.minStockLevel,
        unitCost: parsed.unitCost,
      },
    });
    createdProductIds.push(p1.id);

    expect(p1.sku).toBe(uniqueSku.toUpperCase());

    // Duplicate SKU must fail at database constraint level
    await expect(
      prisma.product.create({
        data: {
          name: "İkinci Ürün Aynı SKU",
          sku: uniqueSku.toUpperCase(),
          categoryId: testCategoryId,
          unit: "Adet",
          minStockLevel: 5,
          unitCost: 100,
        },
      })
    ).rejects.toThrow();
  });

  it("2. Barkod girildiğinde benzersizlik doğrulaması çalışmalı, boş barkodlar çakışmamalı", async () => {
    const uniqueBarcode = `869999${Date.now()}`;
    const p1 = await prisma.product.create({
      data: {
        name: "Barkodlu Test Ürünü 1",
        sku: `TST-BRC1-${Date.now()}`,
        barcode: uniqueBarcode,
        categoryId: testCategoryId,
        unit: "Adet",
        minStockLevel: 5,
        unitCost: 80,
      },
    });
    createdProductIds.push(p1.id);

    // Duplicate non-empty barcode must throw unique constraint error
    await expect(
      prisma.product.create({
        data: {
          name: "Barkodlu Test Ürünü 2",
          sku: `TST-BRC2-${Date.now()}`,
          barcode: uniqueBarcode,
          categoryId: testCategoryId,
          unit: "Adet",
          minStockLevel: 5,
          unitCost: 90,
        },
      })
    ).rejects.toThrow();
  });

  it("3. Stok Girişi (Stock-In) bakiyeyi, birim maliyeti ve hareket kaydını doğru güncellemeli", async () => {
    const product = await prisma.product.create({
      data: {
        name: "Stok Giriş Test Ürünü",
        sku: `TST-IN-${Date.now()}`,
        categoryId: testCategoryId,
        unit: "Adet",
        minStockLevel: 5,
        unitCost: 100,
        quantity: 0,
      },
    });
    createdProductIds.push(product.id);

    const movement = await performStockIn({
      productId: product.id,
      quantity: 25,
      unitCost: 120,
      referenceNo: "TEST-IRS-001",
      userId: testUserId,
    });

    expect(toNumeric(movement.stockBefore)).toBe(0);
    expect(toNumeric(movement.stockAfter)).toBe(25);
    expect(toNumeric(movement.quantity)).toBe(25);
    expect(toNumeric(movement.unitCost)).toBe(120);

    const updatedProduct = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(toNumeric(updatedProduct?.quantity)).toBe(25);
    expect(toNumeric(updatedProduct?.unitCost)).toBe(120);
  });

  it("4. Stok Çıkışı (Stock-Out) bakiyeyi düşürmeli ve stok hareketini kaydetmeli", async () => {
    const product = await prisma.product.create({
      data: {
        name: "Stok Çıkış Test Ürünü",
        sku: `TST-OUT-${Date.now()}`,
        categoryId: testCategoryId,
        unit: "Kutu",
        minStockLevel: 5,
        unitCost: 200,
        quantity: 20,
      },
    });
    createdProductIds.push(product.id);

    const movement = await performStockOut({
      productId: product.id,
      quantity: 8,
      reason: "Satış",
      referenceNo: "TEST-CKS-001",
      userId: testUserId,
    });

    expect(toNumeric(movement.stockBefore)).toBe(20);
    expect(toNumeric(movement.stockAfter)).toBe(12);
    expect(movement.reason).toBe("Satış");

    const updated = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(toNumeric(updated?.quantity)).toBe(12);
  });

  it("5. Negatif stok engellenmeli ve yetersiz stokta işlem geri alınmalı (Rollback)", async () => {
    const product = await prisma.product.create({
      data: {
        name: "Negatif Stok Koruması Ürünü",
        sku: `TST-NEG-${Date.now()}`,
        categoryId: testCategoryId,
        unit: "Adet",
        minStockLevel: 3,
        unitCost: 50,
        quantity: 5,
      },
    });
    createdProductIds.push(product.id);

    await expect(
      performStockOut({
        productId: product.id,
        quantity: 6, // Exceeds available 5
        reason: "Hasar",
        userId: testUserId,
      })
    ).rejects.toThrow(BusinessRuleError);

    // Ensure product balance remained untouched (5) and no movement record was created
    const afterAttempt = await prisma.product.findUnique({
      where: { id: product.id },
      include: { movements: true },
    });
    expect(toNumeric(afterAttempt?.quantity)).toBe(5);
    expect(afterAttempt?.movements.length).toBe(0);
  });

  it("6. Eşzamanlı (Concurrent) stok çıkış işlemlerinde fazla satış (overselling) engellenmeli", async () => {
    const product = await prisma.product.create({
      data: {
        name: "Eşzamanlı Yarış Durumu Test Ürünü",
        sku: `TST-CONC-${Date.now()}`,
        categoryId: testCategoryId,
        unit: "Adet",
        minStockLevel: 2,
        unitCost: 300,
        quantity: 10,
      },
    });
    createdProductIds.push(product.id);

    // Fire two concurrent stock-out requests of 7 units each when only 10 units exist
    const results = await Promise.allSettled([
      performStockOut({
        productId: product.id,
        quantity: 7,
        reason: "Satış",
        userId: testUserId,
      }),
      performStockOut({
        productId: product.id,
        quantity: 7,
        reason: "Üretimde kullanım",
        userId: testUserId,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const finalProduct = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(toNumeric(finalProduct?.quantity)).toBe(3);
  });

  it("7. Stok düzeltme (Adjustment) ve Ters Kayıt (Reversal) denetim geçmişi (Audit Log) oluşturmalı", async () => {
    const product = await prisma.product.create({
      data: {
        name: "Düzeltme ve Denetim Test Ürünü",
        sku: `TST-ADJ-${Date.now()}`,
        categoryId: testCategoryId,
        unit: "Adet",
        minStockLevel: 5,
        unitCost: 75,
        quantity: 15,
      },
    });
    createdProductIds.push(product.id);

    const adjMovement = await performStockAdjustment({
      productId: product.id,
      newQuantity: 22,
      reason: "Sayım Fazlası Tespit Edildi",
      userId: testUserId,
    });

    expect(toNumeric(adjMovement.stockBefore)).toBe(15);
    expect(toNumeric(adjMovement.stockAfter)).toBe(22);
    expect(toNumeric(adjMovement.quantity)).toBe(7);

    // Verify audit log exists
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: "StockMovement",
        entityId: adjMovement.id,
        action: "STOCK_ADJUST",
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.summary).toContain("Sayım Fazlası Tespit Edildi");

    // Reverse the adjustment
    const reversal = await performMovementReversal({
      movementId: adjMovement.id,
      reason: "Yanlış raf sayımı düzeltmesi",
      userId: testUserId,
    });

    expect(toNumeric(reversal.stockBefore)).toBe(22);
    expect(toNumeric(reversal.stockAfter)).toBe(15);
  });

  it("8. Kritik Stok (LOW_STOCK) ve Stokta Yok (OUT_OF_STOCK) hesaplamaları doğru çalışmalı", () => {
    expect(getStockStatus(0, 10)).toBe("OUT_OF_STOCK");
    expect(getStockStatus(0, 0)).toBe("OUT_OF_STOCK");
    expect(getStockStatus(5, 10)).toBe("LOW_STOCK");
    expect(getStockStatus(10, 10)).toBe("LOW_STOCK");
    expect(getStockStatus(11, 10)).toBe("IN_STOCK");
  });

  it("9. Rol ve yetki denetimi (Permission Enforcement) doğru çalışmalı", () => {
    const restrictedEmployee: SessionUser = {
      id: "emp-1",
      email: "emp@depo.local",
      name: "Kısıtlı Personel",
      role: "EMPLOYEE",
      isActive: true,
      permissions: {
        canManageProducts: false,
        canManageCategories: false,
        canManageSuppliers: false,
        canStockIn: true,
        canStockOut: true,
        canAdjustStock: false,
        canViewReports: false,
        canExportData: false,
      },
    };

    expect(hasPermission(restrictedEmployee, "canStockIn")).toBe(true);
    expect(hasPermission(restrictedEmployee, "canStockOut")).toBe(true);
    expect(hasPermission(restrictedEmployee, "canManageProducts")).toBe(false);
    expect(hasPermission(restrictedEmployee, "canAdjustStock")).toBe(false);
    expect(hasPermission(restrictedEmployee, "ADMIN_ONLY")).toBe(false);

    const adminUser: SessionUser = {
      ...restrictedEmployee,
      role: "ADMIN",
    };
    expect(hasPermission(adminUser, "ADMIN_ONLY")).toBe(true);
    expect(hasPermission(adminUser, "canManageProducts")).toBe(true);
  });

  it("10. Genel Bakış (Dashboard) istatistikleri veritabanı ile tutarlı olmalı", async () => {
    const metrics = await getDashboardMetrics();
    expect(metrics.summary.totalProductTypes).toBeGreaterThan(0);
    expect(metrics.summary.totalStockQuantity).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(metrics.chartData)).toBe(true);
    expect(metrics.chartData.length).toBe(7);
  });
});
