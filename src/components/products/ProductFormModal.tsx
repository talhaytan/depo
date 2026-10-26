"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Loader2, Save, Wand2 } from "lucide-react";

const DEFAULT_UNITS = [
  "Adet",
  "Kutu",
  "Paket",
  "Kg",
  "Gram",
  "Litre",
  "Metre",
  "Koli",
  "Palet",
];

export interface EditableProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  categoryId: string;
  supplierId: string | null;
  description: string | null;
  imageUrl?: string | null;
  unit: string;
  minStockLevel: number;
  unitCost: number;
  quantity?: number;
}

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  product?: EditableProduct | null;
  onSuccess?: () => void;
}

function generateAutoSku(productName: string): string {
  const clean = productName
    .toUpperCase()
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/İ/g, "I")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9\s]/g, "")
    .trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const prefix = (words[0] || "URN").slice(0, 3);
  const second = (words[1] || "AV").slice(0, 3);
  const rand = String(Math.floor(100 + Math.random() * 900));
  return `FSK-${prefix}-${second}-${rand}`;
}

export function ProductFormModal({
  open,
  onClose,
  product,
  onSuccess,
}: ProductFormModalProps) {
  const { toast } = useToast();
  const isEditing = Boolean(product?.id);

  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [suppliers, setSuppliers] = useState<
    Array<{ id: string; companyName: string }>
  >([]);
  const [units, setUnits] = useState<string[]>(DEFAULT_UNITS);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [skuManuallyEdited, setSkuManuallyEdited] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [unit, setUnit] = useState("Adet");
  const [minStockLevel, setMinStockLevel] = useState("250");
  const [unitCost, setUnitCost] = useState("0");
  const [casePriceHelper, setCasePriceHelper] = useState("");
  const [initialQuantity, setInitialQuantity] = useState("0");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const loadMetadata = useCallback(async (isNewProduct: boolean) => {
    try {
      const [catRes, supRes, setRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/suppliers"),
        fetch("/api/settings"),
      ]);
      const catData = await catRes.json();
      const supData = await supRes.json();
      const setData = await setRes.json();

      if (catData.categories) {
        setCategories(catData.categories);
        if (isNewProduct && catData.categories.length > 0) {
          setCategoryId((prev) => prev || catData.categories[0].id);
        }
      }
      if (supData.suppliers) {
        setSuppliers(supData.suppliers);
      }
      if (setData.settings?.customUnits) {
        const parsedUnits = String(setData.settings.customUnits)
          .split(",")
          .map((u: string) => u.trim())
          .filter(Boolean);
        if (parsedUnits.length > 0) setUnits(parsedUnits);
      }
    } catch {
      // fallback to defaults
    }
  }, []);

  useEffect(() => {
    if (open) {
      setErrorMsg(null);
      setIsDirty(false);
      if (product) {
        setName(product.name);
        setSku(product.sku);
        setSkuManuallyEdited(true);
        setBarcode(product.barcode || "");
        setCategoryId(product.categoryId);
        setSupplierId(product.supplierId || "");
        setUnit(product.unit || "Adet");
        setMinStockLevel(String(product.minStockLevel));
        setUnitCost(String(product.unitCost));
        setCasePriceHelper(String(Math.round(product.unitCost * 250)));
        setDescription(product.description || "");
        setImageUrl(product.imageUrl || "");
        loadMetadata(false);
      } else {
        setName("");
        setSku("");
        setSkuManuallyEdited(false);
        setBarcode("");
        setCategoryId("");
        setSupplierId("");
        setUnit("Adet");
        setMinStockLevel("250");
        setUnitCost("0");
        setCasePriceHelper("");
        setInitialQuantity("0");
        setDescription("");
        setImageUrl("");
        loadMetadata(true);
      }
    }
  }, [open, product, loadMetadata]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEditing && !skuManuallyEdited && val.trim().length >= 3) {
      setSku(generateAutoSku(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const url = isEditing ? `/api/products/${product!.id}` : "/api/products";
      const method = isEditing ? "PATCH" : "POST";

      const finalSku = (sku.trim() || generateAutoSku(name)).toUpperCase();

      const payload: Record<string, unknown> = {
        name,
        sku: finalSku,
        barcode: barcode.trim() || null,
        categoryId,
        supplierId: supplierId || null,
        unit,
        minStockLevel: Number(minStockLevel),
        unitCost: Number(unitCost),
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
      };

      if (!isEditing) {
        payload.initialQuantity = Number(initialQuantity) || 0;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Ürün kaydedilirken hata oluştu.");
        return;
      }

      toast({
        type: "success",
        title: isEditing ? "Ürün Güncellendi" : "Yeni Ürün Eklendi",
        message: `${name} (${finalSku}) başarıyla kaydedildi.`,
      });

      setIsDirty(false);
      onSuccess?.();
      onClose();
    } catch {
      setErrorMsg("Sunucu hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Ürün Bilgilerini Düzenle" : "Yeni Ürün Kartı Oluştur"}
      description={
        isEditing
          ? "Ürün kartı, kritik stok eşiği ve birim alış maliyetini güncelleyin."
          : "Envantere yeni bir fişek, tüfek veya malzeme tanımlayın. Stok kodu ve kutu görseli otomatik oluşturulabilir."
      }
      maxWidth="xl"
      isDirty={isDirty}
    >
      <form
        onSubmit={handleSubmit}
        onChange={() => setIsDirty(true)}
        className="space-y-4"
      >
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Ürün Adı *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Örn: Sterling 12 Kalibre 32gr Keklik Özel — No: 6"
              className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-stone-700">
                Stok Kodu (SKU) *
              </label>
              <button
                type="button"
                onClick={() => {
                  setSku(generateAutoSku(name || "URUN"));
                  setSkuManuallyEdited(true);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#f26522] hover:underline"
              >
                <Wand2 className="w-3 h-3" />
                Otomatik Kod Üret
              </button>
            </div>
            <input
              type="text"
              required
              value={sku}
              onChange={(e) => {
                setSku(e.target.value.toUpperCase());
                setSkuManuallyEdited(true);
              }}
              placeholder="Örn: FSK-STR-32-99"
              className="w-full px-3.5 py-2 text-sm font-mono uppercase border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Barkod No (İsteğe Bağlı)
            </label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Barkod okutun veya boş bırakın..."
              className="w-full px-3.5 py-2 text-sm font-mono border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Kategori *
            </label>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522]"
            >
              <option value="">-- Kategori Seçiniz --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Varsayılan Tedarikçi (İsteğe Bağlı)
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522]"
            >
              <option value="">-- Tedarikçi Seçilmedi --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.companyName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Tek Fişek / Birim Fiyatı (₺) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={unitCost}
              onChange={(e) => {
                const v = e.target.value;
                setUnitCost(v);
                if (v && !isNaN(Number(v))) {
                  setCasePriceHelper(String(Math.round(Number(v) * 250)));
                }
              }}
              className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522]"
            />
            <p className="text-[11px] text-stone-500 mt-0.5">
              25&apos;li Kutu:{" "}
              <strong>
                {(Number(unitCost || 0) * 25).toLocaleString("tr-TR")} ₺
              </strong>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              250&apos;li Koli Fiyatından Hesapla (Kolay Giriş)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={casePriceHelper}
              onChange={(e) => {
                const val = e.target.value;
                setCasePriceHelper(val);
                if (val && !isNaN(Number(val))) {
                  setUnitCost((Number(val) / 250).toFixed(2));
                }
              }}
              placeholder="Örn: 3700 yazarsanız tek fişek 14.80 ₺ olur"
              className="w-full px-3.5 py-2 text-sm border border-stone-200 bg-stone-50 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522]"
            />
            <p className="text-[11px] text-stone-500 mt-0.5">
              Koli fiyatını yazarsanız tek fişek fiyatı otomatik 250&apos;ye bölünür.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Minimum (Kritik) Stok Eşiği ({unit}) *
            </label>
            <input
              type="number"
              step="any"
              min="0"
              required
              value={minStockLevel}
              onChange={(e) => setMinStockLevel(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522]"
            />
          </div>

          {!isEditing && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Açılış Başlangıç Stoğu ({unit})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={initialQuantity}
                onChange={(e) => setInitialQuantity(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522]"
              />
              <div className="flex flex-wrap gap-1 mt-1">
                {[
                  { label: "250 (1 Koli)", val: "250" },
                  { label: "500 (2 Koli)", val: "500" },
                  { label: "1000 (4 Koli)", val: "1000" },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setInitialQuantity(preset.val)}
                    className="px-2 py-0.5 text-[10px] font-semibold rounded bg-stone-100 hover:bg-orange-50 hover:text-[#f26522] text-stone-600"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Ürün Açıklaması / Teknik Özellikler (İsteğe Bağlı)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Raf konumu, saçma numarası veya ek notlar..."
              className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522]"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-xl hover:bg-stone-50"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#f26522] hover:bg-[#dd5616] rounded-xl shadow-xs transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEditing ? "Değişiklikleri Kaydet" : "Ürünü Oluştur"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
