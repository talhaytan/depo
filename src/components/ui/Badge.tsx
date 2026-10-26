import { cn, getMovementTypeLabel, getStockStatusLabel, StockStatus } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

export function StockStatusBadge({
  status,
  size = "sm",
}: {
  status: StockStatus;
  size?: "sm" | "md";
}) {
  const label = getStockStatusLabel(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-full border",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        status === "IN_STOCK" &&
          "bg-emerald-50 text-emerald-700 border-emerald-200",
        status === "LOW_STOCK" &&
          "bg-amber-50 text-amber-800 border-amber-200",
        status === "OUT_OF_STOCK" &&
          "bg-rose-50 text-rose-700 border-rose-200"
      )}
    >
      {status === "IN_STOCK" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
      {status === "LOW_STOCK" && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
      {status === "OUT_OF_STOCK" && <XCircle className="w-3.5 h-3.5 text-rose-600" />}
      {label}
    </span>
  );
}

export function MovementTypeBadge({
  type,
  isReversed,
}: {
  type: string;
  isReversed?: boolean;
}) {
  const label = getMovementTypeLabel(type);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-md border",
        type === "IN" && "bg-emerald-50 text-emerald-700 border-emerald-200",
        type === "OUT" && "bg-rose-50 text-rose-700 border-rose-200",
        type === "ADJUSTMENT" && "bg-indigo-50 text-indigo-700 border-indigo-200",
        type === "REVERSAL" && "bg-slate-100 text-slate-700 border-slate-300",
        isReversed && "line-through opacity-75"
      )}
    >
      {label}
    </span>
  );
}
