"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatQuantity } from "@/lib/utils";
import {
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  Loader2,
  Package,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from "lucide-react";

export type StockOperationType = "IN" | "OUT" | "ADJUST";

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  imageUrl?: string | null;
  quantity: number;
  unit: string;
  unitCost: number;
  supplierId: string | null;
}

interface SupplierOption {
  id: string;
  companyName: string;
}

interface StockOperationModalProps {
  open: boolean;
  onClose: () => void;
  operationType: StockOperationType;
  preselectedProductId?: string;
  onSuccess?: () => void;
}

const STOCK_OUT_REASONS = [
  "Satış (Ruhsatlı / Perakende)",
  "Poligon / Atışta Kullanım",
  "Üretimde kullanım",
  "Hasar / Deformasyon",
  "İade dışı kayıp",
  "Diğer",
];

const ADJUSTMENT_REASONS = [
  "Periyodik Sayım Fazlası",
  "Periyodik Sayım Eksiği",
  "Kayıt Hatası Düzeltme",
  "Depo İçi Kontrolde Fark",
  "Diğer",
];

export function StockOperationModal({
  open,
  onClose,
  operationType: initialOpType,
  preselectedProductId,
  onSuccess,
}: StockOperationModalProps) {
  const { toast } = useToast();
  const [activeType, setActiveType] =
    useState<StockOperationType>(initialOpType);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form fields
  const [productSearch, setProductSearch] = useState("");
  const [productId, setProductId] = useState(preselectedProductId || "");
  const [quantity, setQuantity] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [reason, setReason] = useState(STOCK_OUT_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [movementDate, setMovementDate] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [notes, setNotes] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");

  const loadData = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const [prodRes, supRes] = await Promise.all([
        fetch("/api/products?pageSize=300"),
        fetch("/api/suppliers"),
      ]);
      const prodData = await prodRes.json();
      const supData = await supRes.json();
      if (prodData.items) {
        setProducts(prodData.items);
        if (preselectedProductId) {
          const found = prodData.items.find(
            (p: ProductOption) => p.id === preselectedProductId
          );
          if (found) {
            setProductId(found.id);
            setUnitCost(String(found.unitCost));
            setNewQuantity(String(found.quantity));
            setSupplierId(found.supplierId || "");
          }
        }
      }
      if (supData.suppliers) {
        setSuppliers(supData.suppliers);
      }
    } catch {
      // handled silently
    } finally {
      setLoadingOptions(false);
    }
  }, [preselectedProductId]);

  useEffect(() => {
    if (open) {
      setActiveType(initialOpType);
      setProductId(preselectedProductId || "");
      setErrorMsg(null);
      setQuantity("");
      setReferenceNo("");
      setNotes("");
      setCustomReason("");
      setProductSearch("");
      setShowAdvanced(false);
      setMovementDate(new Date().toISOString().slice(0, 16));
      setIdempotencyKey(
        `IDEMP-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      );
      if (initialOpType === "OUT") {
        setReason(STOCK_OUT_REASONS[0]);
      } else if (initialOpType === "ADJUST") {
        setReason(ADJUSTMENT_REASONS[0]);
      }
      loadData();
    }
  }, [open, initialOpType, preselectedProductId, loadData]);

  const handleSwitchType = (nextType: StockOperationType) => {
    setActiveType(nextType);
    setErrorMsg(null);
    if (nextType === "OUT") {
      setReason(STOCK_OUT_REASONS[0]);
    } else if (nextType === "ADJUST") {
      setReason(ADJUSTMENT_REASONS[0]);
      if (selectedProduct) {
        setNewQuantity(String(selectedProduct.quantity));
      }
    }
  };

  const selectedProduct = products.find((p) => p.id === productId);

  const handleProductChange = (id: string) => {
    setProductId(id);
    const found = products.find((p) => p.id === id);
    if (found) {
      setUnitCost(String(found.unitCost));
      setNewQuantity(String(found.quantity));
      if (found.supplierId) setSupplierId(found.supplierId);
    }
  };

  // Turkish-aware Barcode / SKU / Name quick filter
  const filteredProducts = products.filter((p) => {
    if (!productSearch.trim()) return true;
    const q = productSearch.trim().toLocaleLowerCase("tr-TR");
    return (
      p.name.toLocaleLowerCase("tr-TR").includes(q) ||
      p.sku.toLocaleLowerCase("tr-TR").includes(q) ||
      (p.barcode || "").toLocaleLowerCase("tr-TR").includes(q)
    );
  });

  // Live preview of resulting stock after operation
  const numQty = Number(quantity) || 0;
  const previewAfterStock = selectedProduct
    ? activeType === "IN"
      ? selectedProduct.quantity + numQty
      : activeType === "OUT"
      ? selectedProduct.quantity - numQty
      : Number(newQuantity) || 0
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);

    if (!productId) {
      setErrorMsg("Lütfen işlem yapılacak ürünü seçiniz.");
      return;
    }

    setSubmitting(true);
    try {
      let endpoint = "/api/stock/in";
      let payload: Record<string, unknown> = {
        productId,
        idempotencyKey,
        referenceNo,
        movementDate,
        notes,
      };

      if (activeType === "IN") {
        endpoint = "/api/stock/in";
        payload = {
          ...payload,
          quantity: Number(quantity),
          unitCost: unitCost !== "" ? Number(unitCost) : undefined,
          supplierId: supplierId || null,
        };
      } else if (activeType === "OUT") {
        endpoint = "/api/stock/out";
        const finalReason =
          reason === "Diğer" && customReason.trim()
            ? `Diğer: ${customReason.trim()}`
            : reason;
        payload = {
          ...payload,
          quantity: Number(quantity),
          reason: finalReason,
        };
      } else {
        endpoint = "/api/stock/adjust";
        const finalReason =
          reason === "Diğer" && customReason.trim()
            ? `Diğer: ${customReason.trim()}`
            : reason;
        payload = {
          ...payload,
          newQuantity: Number(newQuantity),
          reason: finalReason,
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "İşlem gerçekleştirilemedi.");
        return;
      }

      toast({
        type: "success",
        title:
          activeType === "IN"
            ? "Stok Girişi Kaydedildi"
            : activeType === "OUT"
            ? "Stok Çıkışı Kaydedildi"
            : "Stok Düzeltme Kaydedildi",
        message: `${
          selectedProduct?.name || "Ürün"
        } güncel stok: ${formatQuantity(
          data.movement?.stockAfter,
          selectedProduct?.unit
        )}`,
      });

      onSuccess?.();
      onClose();
    } catch {
      setErrorMsg("Sunucu ile bağlantı kurulurken hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  const isDirty = Boolean(quantity || referenceNo || notes);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Hızlı Stok İşlemi"
      description="Stok girişi, satış/çıkış veya sayım düzeltme işlemini anında kaydedin."
      maxWidth="lg"
      isDirty={isDirty}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 3-Tab Operation Switcher inside the Modal */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-stone-100 rounded-xl border border-stone-200/80">
          <button
            type="button"
            onClick={() => handleSwitchType("IN")}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeType === "IN"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            Stok Girişi
          </button>

          <button
            type="button"
            onClick={() => handleSwitchType("OUT")}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeType === "OUT"
                ? "bg-[#f26522] text-white shadow-xs"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Satış / Çıkış
          </button>

          <button
            type="button"
            onClick={() => handleSwitchType("ADJUST")}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeType === "ADJUST"
                ? "bg-stone-800 text-white shadow-xs"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Sayım Düzelt
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {errorMsg}
          </div>
        )}

        {/* Product Selection with Barcode / SKU quick search */}
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Ürün Seçimi (Ad, SKU veya Barkod ile ara) *
          </label>
          {!preselectedProductId && (
            <input
              type="text"
              value={productSearch}
              onChange={(e) => {
                const val = e.target.value;
                setProductSearch(val);
                const exactMatch = products.find(
                  (p) =>
                    p.barcode === val.trim() ||
                    p.sku.toLocaleLowerCase("tr-TR") ===
                      val.trim().toLocaleLowerCase("tr-TR")
                );
                if (exactMatch) {
                  handleProductChange(exactMatch.id);
                }
              }}
              placeholder="Hızlı bulmak için marka, gramaj veya barkod yazın (Örn: Sterling, RC, 32gr)..."
              className="w-full px-3.5 py-2 mb-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522]"
            />
          )}
          <select
            value={productId}
            onChange={(e) => handleProductChange(e.target.value)}
            required
            disabled={loadingOptions}
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-stone-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522]"
          >
            <option value="">
              -- Ürün Seçiniz ({filteredProducts.length} ürün) --
            </option>
            {filteredProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — Mevcut: {formatQuantity(p.quantity, p.unit)}
              </option>
            ))}
          </select>
        </div>

        {/* Visual Product Summary & Live Stock Preview Card */}
        {selectedProduct && (
          <div className="p-3.5 rounded-xl bg-[#f8f6f2] border border-stone-200/90 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-10 rounded-lg bg-stone-900 border border-stone-200 overflow-hidden shrink-0 flex items-center justify-center">
                {selectedProduct.imageUrl ? (
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="w-4 h-4 text-stone-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-stone-900 truncate">
                  {selectedProduct.name}
                </p>
                <p className="text-[11px] text-stone-500">
                  Birim Fiyat: {formatCurrency(selectedProduct.unitCost)} •
                  Mevcut:{" "}
                  <strong className="text-stone-800">
                    {formatQuantity(
                      selectedProduct.quantity,
                      selectedProduct.unit
                    )}
                  </strong>
                </p>
              </div>
            </div>

            {/* Live Stock After Operation Preview */}
            {previewAfterStock !== null && (quantity !== "" || activeType === "ADJUST") && (
              <div className="text-right shrink-0 pl-2 border-l border-stone-200">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 block">
                  İşlem Sonrası
                </span>
                <div className="inline-flex items-center gap-1 text-xs font-bold">
                  <span className="text-stone-500">
                    {formatQuantity(selectedProduct.quantity)}
                  </span>
                  <ArrowRight className="w-3 h-3 text-stone-400" />
                  <span
                    className={
                      previewAfterStock < 0
                        ? "text-rose-600"
                        : activeType === "IN"
                        ? "text-emerald-600"
                        : "text-[#f26522]"
                    }
                  >
                    {formatQuantity(previewAfterStock)} {selectedProduct.unit}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeType !== "ADJUST" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                {activeType === "IN"
                  ? "Giriş Miktarı (Fişek / Adet) *"
                  : "Çıkış Miktarı (Fişek / Adet) *"}
              </label>
              <input
                type="number"
                step="any"
                min="0.001"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Örn: 25 (1 Kutu) veya 250 (1 Koli)"
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522]"
              />
              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                {[
                  { label: "25 (1 Kutu)", val: "25" },
                  { label: "50 (2 Kutu)", val: "50" },
                  { label: "125 (5 Kutu)", val: "125" },
                  { label: "250 (1 Koli)", val: "250" },
                  { label: "500 (2 Koli)", val: "500" },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setQuantity(preset.val)}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border transition-colors cursor-pointer ${
                      quantity === preset.val
                        ? "bg-[#f26522] text-white border-[#f26522]"
                        : "border-stone-200 bg-stone-50 hover:bg-orange-50 hover:border-orange-200 hover:text-[#f26522] text-stone-600"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              {activeType === "OUT" &&
                selectedProduct &&
                Number(quantity) > selectedProduct.quantity && (
                  <p className="text-xs text-rose-600 mt-1.5 font-semibold">
                    Uyarı: Girilen miktar mevcut stoktan (
                    {selectedProduct.quantity} {selectedProduct.unit}) fazladır!
                  </p>
                )}
            </div>

            {activeType === "IN" ? (
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Tek Fişek / Birim Alış Fiyatı (₺)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522]"
                />
                {numQty > 0 && Number(unitCost) > 0 && (
                  <p className="text-[11px] text-stone-500 mt-1">
                    Toplam Giriş Tutarı:{" "}
                    <strong className="text-stone-800">
                      {formatCurrency(numQty * Number(unitCost))}
                    </strong>
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Çıkış Nedeni *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522]"
                >
                  {STOCK_OUT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {numQty > 0 && selectedProduct && (
                  <p className="text-[11px] text-stone-500 mt-1">
                    Toplam Satış / Çıkış Tutarı:{" "}
                    <strong className="text-stone-800">
                      {formatCurrency(numQty * selectedProduct.unitCost)}
                    </strong>
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Yeni Gerçek Stok Miktarı *{" "}
                {selectedProduct ? `(${selectedProduct.unit})` : ""}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Düzeltme Nedeni *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522]"
              >
                {ADJUSTMENT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {activeType !== "IN" && reason === "Diğer" && (
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Diğer Neden Açıklaması *
            </label>
            <input
              type="text"
              required
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Lütfen detaylı açıklama giriniz..."
              className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522]"
            />
          </div>
        )}

        {/* Collapsible Optional Fields (Belge No, Tedarikçi, Tarih, Not) */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 cursor-pointer"
          >
            {showAdvanced ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            Ek Bilgiler (Belge No, Tedarikçi, Tarih, Not)
          </button>

          {showAdvanced && (
            <div className="mt-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeType === "IN" && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Tedarikçi Firma (İsteğe Bağlı)
                    </label>
                    <select
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-white"
                    >
                      <option value="">-- Tedarikçi Seçilmedi --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.companyName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    İrsaliye / Fiş / Belge No
                  </label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="Örn: IRS-2026-0042"
                    className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    İşlem Tarihi
                  </label>
                  <input
                    type="datetime-local"
                    value={movementDate}
                    onChange={(e) => setMovementDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Açıklama / Not
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="İşlemle ilgili ek not..."
                  className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-xl hover:bg-stone-50 cursor-pointer"
          >
            İptal
          </button>

          <button
            type="submit"
            disabled={
              submitting ||
              (activeType === "OUT" &&
                Boolean(selectedProduct) &&
                Number(quantity) > (selectedProduct?.quantity ?? 0))
            }
            className={`inline-flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold text-white rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer ${
              activeType === "IN"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : activeType === "OUT"
                ? "bg-[#f26522] hover:bg-[#dd5616]"
                : "bg-stone-800 hover:bg-stone-900"
            }`}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : activeType === "IN" ? (
              <ArrowDownLeft className="w-4 h-4" />
            ) : activeType === "OUT" ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <SlidersHorizontal className="w-4 h-4" />
            )}
            {activeType === "IN"
              ? "Stok Girişini Kaydet"
              : activeType === "OUT"
              ? "Satış / Çıkışı Kaydet"
              : "Sayım Düzeltmesini Kaydet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
