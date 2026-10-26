import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { getStockStatus, toNumeric } from "./utils";

export class BusinessRuleError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "BusinessRuleError";
    this.status = status;
  }
}

function generateMovementCode(prefix = "HRK"): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${y}${m}${d}-${rand}`;
}

/**
 * Evaluates product stock status transition and creates a deduplicated notification
 * only when the product's stock state meaningfully enters LOW_STOCK or OUT_OF_STOCK.
 */
async function evaluateStockNotification(
  tx: Prisma.TransactionClient,
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    minStockLevel: unknown;
  },
  stockBefore: number,
  stockAfter: number,
  userId: string
) {
  const minLevel = toNumeric(product.minStockLevel);
  const prevStatus = getStockStatus(stockBefore, minLevel);
  const nextStatus = getStockStatus(stockAfter, minLevel);

  if (nextStatus === "IN_STOCK") {
    // Mark unread notifications for this product as resolved/read when stock recovers
    await tx.notification.updateMany({
      where: { productId: product.id, isRead: false },
      data: { isRead: true },
    });
    return;
  }

  // Only emit notification if status changed or if there is no active unread notification for this state
  const stateKey = `PRODUCT_STOCK_STATE:${product.id}:${nextStatus}`;
  const existingUnread = await tx.notification.findFirst({
    where: {
      stateKey,
      isRead: false,
    },
  });

  if (existingUnread && prevStatus === nextStatus) {
    return;
  }

  if (nextStatus === "OUT_OF_STOCK") {
    await tx.notification.create({
      data: {
        type: "OUT_OF_STOCK",
        severity: "CRITICAL",
        title: `Stok Tükendi: ${product.name}`,
        message: `${product.name} (${product.sku}) ürününün stoğu tamamen tükendi (0 ${product.unit}). Acil tedarik planlanmalıdır.`,
        stateKey,
        productId: product.id,
        userId,
      },
    });
  } else if (nextStatus === "LOW_STOCK") {
    await tx.notification.create({
      data: {
        type: "LOW_STOCK",
        severity: "WARNING",
        title: `Kritik Stok Uyarısı: ${product.name}`,
        message: `${product.name} (${product.sku}) kritik stok seviyesine düştü. Mevcut: ${stockAfter} ${product.unit} (Alt Sınır: ${minLevel} ${product.unit}).`,
        stateKey,
        productId: product.id,
        userId,
      },
    });
  }
}

// Mutex queue for in-process concurrency serialization alongside DB transactions
let transactionChain: Promise<unknown> = Promise.resolve();

function runSerialized<T>(fn: () => Promise<T>): Promise<T> {
  const result = transactionChain.then(fn, fn);
  transactionChain = result.catch(() => {});
  return result;
}

export interface StockInParams {
  productId: string;
  quantity: number;
  unitCost?: number;
  supplierId?: string | null;
  referenceNo?: string | null;
  movementDate?: string | Date;
  notes?: string | null;
  idempotencyKey?: string | null;
  userId: string;
}

export async function performStockIn(params: StockInParams) {
  const qty = Number(params.quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new BusinessRuleError("Stok giriş miktarı 0'dan büyük olmalıdır.");
  }

  return runSerialized(async () => {
    return prisma.$transaction(async (tx) => {
      if (params.idempotencyKey) {
        const existing = await tx.stockMovement.findUnique({
          where: { idempotencyKey: params.idempotencyKey },
          include: { product: true, user: { select: { id: true, name: true } } },
        });
        if (existing) return existing;
      }

      const product = await tx.product.findUnique({
        where: { id: params.productId },
      });

      if (!product) {
        throw new BusinessRuleError("Ürün bulunamadı.", 404);
      }
      if (product.isArchived) {
        throw new BusinessRuleError(
          "Arşivlenmiş ürünlere stok girişi yapılamaz. Önce ürünü aktif duruma getiriniz."
        );
      }

      const stockBefore = toNumeric(product.quantity);
      const stockAfter = Number((stockBefore + qty).toFixed(3));
      const newUnitCost =
        params.unitCost !== undefined &&
        params.unitCost !== null &&
        Number.isFinite(Number(params.unitCost)) &&
        Number(params.unitCost) >= 0
          ? Number(params.unitCost)
          : toNumeric(product.unitCost);

      await tx.product.update({
        where: { id: product.id },
        data: {
          quantity: stockAfter,
          unitCost: newUnitCost,
          ...(params.supplierId ? { supplierId: params.supplierId } : {}),
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          movementCode: generateMovementCode("GRS"),
          idempotencyKey: params.idempotencyKey || null,
          productId: product.id,
          type: "IN",
          quantity: qty,
          stockBefore,
          stockAfter,
          unitCost: newUnitCost,
          reason: "Mal Kabul / Stok Girişi",
          referenceNo: params.referenceNo || null,
          notes: params.notes || null,
          supplierId: params.supplierId || product.supplierId || null,
          movementDate: params.movementDate ? new Date(params.movementDate) : new Date(),
          userId: params.userId,
        },
        include: {
          product: true,
          supplier: true,
          user: { select: { id: true, name: true, email: true } },
        },
      });

      await evaluateStockNotification(tx, product, stockBefore, stockAfter, params.userId);

      await tx.auditLog.create({
        data: {
          action: "STOCK_IN",
          entityType: "StockMovement",
          entityId: movement.id,
          userId: params.userId,
          summary: `${product.name} (${product.sku}) için +${qty} ${product.unit} stok girişi yapıldı (${stockBefore} -> ${stockAfter}).`,
          metadata: JSON.stringify({
            movementCode: movement.movementCode,
            productId: product.id,
            sku: product.sku,
            quantity: qty,
            stockBefore,
            stockAfter,
            unitCost: newUnitCost,
            referenceNo: params.referenceNo,
          }),
        },
      });

      return movement;
    });
  });
}

export interface StockOutParams {
  productId: string;
  quantity: number;
  reason: string;
  referenceNo?: string | null;
  movementDate?: string | Date;
  notes?: string | null;
  idempotencyKey?: string | null;
  userId: string;
}

export async function performStockOut(params: StockOutParams) {
  const qty = Number(params.quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new BusinessRuleError("Stok çıkış miktarı 0'dan büyük olmalıdır.");
  }

  return runSerialized(async () => {
    return prisma.$transaction(async (tx) => {
      if (params.idempotencyKey) {
        const existing = await tx.stockMovement.findUnique({
          where: { idempotencyKey: params.idempotencyKey },
          include: { product: true, user: { select: { id: true, name: true } } },
        });
        if (existing) return existing;
      }

      const product = await tx.product.findUnique({
        where: { id: params.productId },
      });

      if (!product) {
        throw new BusinessRuleError("Ürün bulunamadı.", 404);
      }
      if (product.isArchived) {
        throw new BusinessRuleError("Arşivlenmiş ürünlerden stok çıkışı yapılamaz.");
      }

      const stockBefore = toNumeric(product.quantity);
      if (stockBefore < qty) {
        throw new BusinessRuleError(
          `Yetersiz stok! Mevcut stok: ${stockBefore} ${product.unit}, talep edilen çıkış: ${qty} ${product.unit}. Stok eksiye düşemez.`
        );
      }

      const stockAfter = Number((stockBefore - qty).toFixed(3));
      if (stockAfter < 0) {
        throw new BusinessRuleError("Stok miktarı negatif olamaz.");
      }

      // Atomic conditional update to guarantee non-negative balance even under race conditions
      const updateResult = await tx.product.updateMany({
        where: {
          id: product.id,
          quantity: { gte: qty },
        },
        data: {
          quantity: stockAfter,
        },
      });

      if (updateResult.count === 0) {
        throw new BusinessRuleError(
          "Eşzamanlı işlem nedeniyle kullanılabilir stok yetersiz kaldı. Lütfen tekrar deneyiniz.",
          409
        );
      }

      const movement = await tx.stockMovement.create({
        data: {
          movementCode: generateMovementCode("CKS"),
          idempotencyKey: params.idempotencyKey || null,
          productId: product.id,
          type: "OUT",
          quantity: qty,
          stockBefore,
          stockAfter,
          unitCost: toNumeric(product.unitCost),
          reason: params.reason,
          referenceNo: params.referenceNo || null,
          notes: params.notes || null,
          movementDate: params.movementDate ? new Date(params.movementDate) : new Date(),
          userId: params.userId,
        },
        include: {
          product: true,
          user: { select: { id: true, name: true, email: true } },
        },
      });

      await evaluateStockNotification(tx, product, stockBefore, stockAfter, params.userId);

      await tx.auditLog.create({
        data: {
          action: "STOCK_OUT",
          entityType: "StockMovement",
          entityId: movement.id,
          userId: params.userId,
          summary: `${product.name} (${product.sku}) için -${qty} ${product.unit} stok çıkışı yapıldı (${stockBefore} -> ${stockAfter}). Neden: ${params.reason}`,
          metadata: JSON.stringify({
            movementCode: movement.movementCode,
            productId: product.id,
            sku: product.sku,
            quantity: qty,
            stockBefore,
            stockAfter,
            reason: params.reason,
            referenceNo: params.referenceNo,
          }),
        },
      });

      return movement;
    });
  });
}

export interface StockAdjustParams {
  productId: string;
  newQuantity: number;
  reason: string;
  referenceNo?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
  userId: string;
}

export async function performStockAdjustment(params: StockAdjustParams) {
  const targetQty = Number(params.newQuantity);
  if (!Number.isFinite(targetQty) || targetQty < 0) {
    throw new BusinessRuleError("Yeni stok miktarı 0 veya daha büyük olmalıdır.");
  }
  if (!params.reason || params.reason.trim().length < 3) {
    throw new BusinessRuleError("Stok düzeltme nedeni belirtilmelidir.");
  }

  return runSerialized(async () => {
    return prisma.$transaction(async (tx) => {
      if (params.idempotencyKey) {
        const existing = await tx.stockMovement.findUnique({
          where: { idempotencyKey: params.idempotencyKey },
          include: { product: true, user: { select: { id: true, name: true } } },
        });
        if (existing) return existing;
      }

      const product = await tx.product.findUnique({
        where: { id: params.productId },
      });

      if (!product) {
        throw new BusinessRuleError("Ürün bulunamadı.", 404);
      }

      const stockBefore = toNumeric(product.quantity);
      const stockAfter = Number(targetQty.toFixed(3));
      const diff = Number(Math.abs(stockAfter - stockBefore).toFixed(3));

      if (diff === 0) {
        throw new BusinessRuleError(
          "Yeni stok miktarı mevcut stok miktarı ile aynıdır. Herhangi bir değişiklik yapılmadı."
        );
      }

      await tx.product.update({
        where: { id: product.id },
        data: { quantity: stockAfter },
      });

      const movement = await tx.stockMovement.create({
        data: {
          movementCode: generateMovementCode("DZL"),
          idempotencyKey: params.idempotencyKey || null,
          productId: product.id,
          type: "ADJUSTMENT",
          quantity: diff,
          stockBefore,
          stockAfter,
          unitCost: toNumeric(product.unitCost),
          reason: params.reason.trim(),
          referenceNo: params.referenceNo || null,
          notes: params.notes || null,
          movementDate: new Date(),
          userId: params.userId,
        },
        include: {
          product: true,
          user: { select: { id: true, name: true, email: true } },
        },
      });

      await evaluateStockNotification(tx, product, stockBefore, stockAfter, params.userId);

      await tx.auditLog.create({
        data: {
          action: "STOCK_ADJUST",
          entityType: "StockMovement",
          entityId: movement.id,
          userId: params.userId,
          summary: `${product.name} (${product.sku}) stoğu düzeltildi: ${stockBefore} ${product.unit} -> ${stockAfter} ${product.unit}. Neden: ${params.reason}`,
          metadata: JSON.stringify({
            movementCode: movement.movementCode,
            productId: product.id,
            sku: product.sku,
            stockBefore,
            stockAfter,
            difference: stockAfter - stockBefore,
            reason: params.reason,
          }),
        },
      });

      return movement;
    });
  });
}

export interface ReverseMovementParams {
  movementId: string;
  reason: string;
  userId: string;
}

export async function performMovementReversal(params: ReverseMovementParams) {
  if (!params.reason || params.reason.trim().length < 3) {
    throw new BusinessRuleError("Ters kayıt (iptal) nedeni en az 3 karakter olmalıdır.");
  }

  return runSerialized(async () => {
    return prisma.$transaction(async (tx) => {
      const original = await tx.stockMovement.findUnique({
        where: { id: params.movementId },
        include: { product: true },
      });

      if (!original) {
        throw new BusinessRuleError("İptal edilecek stok hareketi bulunamadı.", 404);
      }
      if (original.isReversed) {
        throw new BusinessRuleError("Bu stok hareketi daha önce iptal edilmiş (ters kayıt yapılmış).");
      }
      if (original.type === "REVERSAL") {
        throw new BusinessRuleError("Ters kayıt hareketi tekrar iptal edilemez.");
      }

      const product = original.product;
      const currentStock = toNumeric(product.quantity);
      const origBefore = toNumeric(original.stockBefore);
      const origAfter = toNumeric(original.stockAfter);
      const origDelta = Number((origAfter - origBefore).toFixed(3)); // positive if stock increased, negative if decreased

      // Reversing means subtracting origDelta from currentStock
      const stockAfter = Number((currentStock - origDelta).toFixed(3));

      if (stockAfter < 0) {
        throw new BusinessRuleError(
          `Bu hareketi iptal etmek mevcut stoğu negatif (${stockAfter} ${product.unit}) yapacağı için işlem gerçekleştirilemez.`
        );
      }

      await tx.product.update({
        where: { id: product.id },
        data: { quantity: stockAfter },
      });

      await tx.stockMovement.update({
        where: { id: original.id },
        data: { isReversed: true },
      });

      const reversalMovement = await tx.stockMovement.create({
        data: {
          movementCode: generateMovementCode("TRS"),
          productId: product.id,
          type: "REVERSAL",
          quantity: Math.abs(origDelta),
          stockBefore: currentStock,
          stockAfter,
          unitCost: toNumeric(product.unitCost),
          reason: `Ters Kayıt (${original.movementCode}): ${params.reason.trim()}`,
          referenceNo: original.movementCode,
          reversedMovementId: original.id,
          userId: params.userId,
        },
        include: {
          product: true,
          user: { select: { id: true, name: true, email: true } },
        },
      });

      await evaluateStockNotification(tx, product, currentStock, stockAfter, params.userId);

      await tx.auditLog.create({
        data: {
          action: "STOCK_REVERSAL",
          entityType: "StockMovement",
          entityId: reversalMovement.id,
          userId: params.userId,
          summary: `${original.movementCode} nolu stok hareketi ters kayıt ile iptal edildi (${currentStock} -> ${stockAfter} ${product.unit}). Neden: ${params.reason}`,
          metadata: JSON.stringify({
            originalMovementId: original.id,
            originalMovementCode: original.movementCode,
            reversalMovementCode: reversalMovement.movementCode,
            stockBefore: currentStock,
            stockAfter,
            reason: params.reason,
          }),
        },
      });

      return reversalMovement;
    });
  });
}
