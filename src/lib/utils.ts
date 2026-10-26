import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export function getStockStatus(
  quantity: number | string | { toNumber?: () => number },
  minStockLevel: number | string | { toNumber?: () => number }
): StockStatus {
  const qty = toNumeric(quantity);
  const min = toNumeric(minStockLevel);

  if (qty <= 0) {
    return "OUT_OF_STOCK";
  }
  if (min > 0 && qty <= min) {
    return "LOW_STOCK";
  }
  return "IN_STOCK";
}

export function getStockStatusLabel(status: StockStatus): string {
  switch (status) {
    case "OUT_OF_STOCK":
      return "Stokta Yok";
    case "LOW_STOCK":
      return "Kritik Stok";
    case "IN_STOCK":
      return "Stokta";
  }
}

export function toNumeric(val: unknown): number {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (typeof val === "string") {
    const parsed = parseFloat(val);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (val && typeof val === "object" && "toNumber" in val && typeof (val as { toNumber: () => number }).toNumber === "function") {
    return (val as { toNumber: () => number }).toNumber();
  }
  if (val && typeof val === "object" && "toString" in val) {
    const parsed = parseFloat(String(val));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function formatCurrency(
  amount: unknown,
  currency = "TRY",
  symbol = "₺"
): string {
  const num = toNumeric(amount);
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: currency || "TRY",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${symbol}${num.toFixed(2)}`;
  }
}

export function formatQuantity(amount: unknown, unit?: string): string {
  const num = toNumeric(amount);
  const formatted = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(num);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatDateTR(
  dateInput: Date | string | null | undefined,
  includeTime = true
): string {
  if (!dateInput) return "-";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  }).format(d);
}

export function getMovementTypeLabel(type: string): string {
  switch (type) {
    case "IN":
      return "Stok Girişi";
    case "OUT":
      return "Stok Çıkışı";
    case "ADJUSTMENT":
      return "Stok Düzeltme";
    case "REVERSAL":
      return "Ters Kayıt (İptal)";
    default:
      return type;
  }
}
