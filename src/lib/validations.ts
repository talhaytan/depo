import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ error: "E-posta adresi zorunludur." })
    .trim()
    .email("Geçerli bir e-posta adresi giriniz."),
  password: z
    .string({ error: "Şifre zorunludur." })
    .min(4, "Şifre en az 4 karakter olmalıdır."),
});

export const productSchema = z.object({
  name: z
    .string({ error: "Ürün adı zorunludur." })
    .trim()
    .min(2, "Ürün adı en az 2 karakter olmalıdır.")
    .max(150, "Ürün adı en fazla 150 karakter olabilir."),
  sku: z
    .string({ error: "Stok kodu (SKU) zorunludur." })
    .trim()
    .min(2, "Stok kodu (SKU) en az 2 karakter olmalıdır.")
    .max(64, "Stok kodu en fazla 64 karakter olabilir.")
    .transform((v) => v.toUpperCase()),
  barcode: z
    .string()
    .trim()
    .max(64, "Barkod en fazla 64 karakter olabilir.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  categoryId: z
    .string({ error: "Kategori seçimi zorunludur." })
    .min(1, "Kategori seçimi zorunludur."),
  supplierId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  description: z
    .string()
    .trim()
    .max(1000, "Açıklama en fazla 1000 karakter olabilir.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  imageUrl: z
    .string()
    .trim()
    .max(500, "Görsel bağlantısı çok uzun.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  unit: z
    .string({ error: "Ölçü birimi zorunludur." })
    .trim()
    .min(1, "Ölçü birimi seçiniz."),
  minStockLevel: z.coerce
    .number({ error: "Minimum stok seviyesi sayı olmalıdır." })
    .min(0, "Minimum stok seviyesi negatif olamaz."),
  unitCost: z.coerce
    .number({ error: "Birim maliyet sayı olmalıdır." })
    .min(0, "Birim maliyet negatif olamaz."),
  initialQuantity: z.coerce
    .number()
    .min(0, "Başlangıç stok miktarı negatif olamaz.")
    .optional()
    .default(0),
});

export const stockInSchema = z.object({
  productId: z.string().min(1, "Ürün seçimi zorunludur."),
  quantity: z.coerce
    .number({ error: "Miktar geçerli bir sayı olmalıdır." })
    .positive("Stok giriş miktarı 0'dan büyük olmalıdır."),
  unitCost: z.coerce
    .number({ error: "Birim maliyet geçerli bir sayı olmalıdır." })
    .min(0, "Birim maliyet negatif olamaz.")
    .optional(),
  supplierId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  referenceNo: z
    .string()
    .trim()
    .max(100, "Belge/fatura numarası en fazla 100 karakter olabilir.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  movementDate: z.string().optional(),
  notes: z
    .string()
    .trim()
    .max(500, "Not en fazla 500 karakter olabilir.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  idempotencyKey: z.string().optional().nullable(),
});

export const stockOutSchema = z.object({
  productId: z.string().min(1, "Ürün seçimi zorunludur."),
  quantity: z.coerce
    .number({ error: "Miktar geçerli bir sayı olmalıdır." })
    .positive("Stok çıkış miktarı 0'dan büyük olmalıdır."),
  reason: z
    .string({ error: "Çıkış nedeni zorunludur." })
    .trim()
    .min(2, "Çıkış nedeni seçilmelidir."),
  referenceNo: z
    .string()
    .trim()
    .max(100, "Belge numarası en fazla 100 karakter olabilir.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  movementDate: z.string().optional(),
  notes: z
    .string()
    .trim()
    .max(500, "Not en fazla 500 karakter olabilir.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  idempotencyKey: z.string().optional().nullable(),
});

export const stockAdjustSchema = z.object({
  productId: z.string().min(1, "Ürün seçimi zorunludur."),
  newQuantity: z.coerce
    .number({ error: "Yeni stok miktarı geçerli bir sayı olmalıdır." })
    .min(0, "Yeni stok miktarı negatif olamaz."),
  reason: z
    .string({ error: "Düzeltme nedeni zorunludur." })
    .trim()
    .min(3, "Düzeltme nedeni en az 3 karakter olmalıdır."),
  referenceNo: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  idempotencyKey: z.string().optional().nullable(),
});

export const stockReverseSchema = z.object({
  movementId: z.string().min(1, "Hareket kimliği zorunludur."),
  reason: z
    .string({ error: "İptal/ters kayıt nedeni zorunludur." })
    .trim()
    .min(3, "İptal nedeni en az 3 karakter olmalıdır."),
});

export const categorySchema = z.object({
  name: z
    .string({ error: "Kategori adı zorunludur." })
    .trim()
    .min(2, "Kategori adı en az 2 karakter olmalıdır.")
    .max(80, "Kategori adı en fazla 80 karakter olabilir."),
  description: z
    .string()
    .trim()
    .max(400, "Açıklama en fazla 400 karakter olabilir.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export const supplierSchema = z.object({
  companyName: z
    .string({ error: "Firma adı zorunludur." })
    .trim()
    .min(2, "Firma adı en az 2 karakter olmalıdır.")
    .max(150, "Firma adı en fazla 150 karakter olabilir."),
  contactPerson: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  email: z
    .string()
    .trim()
    .email("Geçerli bir e-posta adresi giriniz.")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : null)),
  address: z
    .string()
    .trim()
    .max(400)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2, "Ad Soyad en az 2 karakter olmalıdır."),
  email: z.string().trim().email("Geçerli bir e-posta adresi giriniz."),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır."),
  role: z.enum(["ADMIN", "EMPLOYEE"]).default("EMPLOYEE"),
  isActive: z.boolean().default(true),
  canManageProducts: z.boolean().default(false),
  canManageCategories: z.boolean().default(false),
  canManageSuppliers: z.boolean().default(false),
  canStockIn: z.boolean().default(true),
  canStockOut: z.boolean().default(true),
  canAdjustStock: z.boolean().default(false),
  canViewReports: z.boolean().default(false),
  canExportData: z.boolean().default(false),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2, "Ad Soyad en az 2 karakter olmalıdır."),
  email: z.string().trim().email("Geçerli bir e-posta adresi giriniz."),
  password: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
  role: z.enum(["ADMIN", "EMPLOYEE"]),
  isActive: z.boolean(),
  canManageProducts: z.boolean(),
  canManageCategories: z.boolean(),
  canManageSuppliers: z.boolean(),
  canStockIn: z.boolean(),
  canStockOut: z.boolean(),
  canAdjustStock: z.boolean(),
  canViewReports: z.boolean(),
  canExportData: z.boolean(),
});

export const settingsSchema = z.object({
  companyName: z.string().trim().min(2, "İşletme adı en az 2 karakter olmalıdır."),
  currency: z.string().trim().min(2, "Para birimi kodu zorunludur."),
  currencySymbol: z.string().trim().min(1, "Para birimi sembolü zorunludur."),
  timezone: z.string().trim().min(2, "Saat dilimi zorunludur."),
  lowStockAlertEnabled: z.boolean(),
  customUnits: z.string().trim().min(2, "En az bir ölçü birimi tanımlanmalıdır."),
  defaultLocation: z.string().trim().min(1, "Varsayılan depo kodu zorunludur."),
});
