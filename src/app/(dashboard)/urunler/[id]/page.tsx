"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  Edit2,
  Package,
  Loader2,
  History,
} from "lucide-react";
import {
  formatCurrency,
  formatDateTR,
  formatQuantity,
  StockStatus,
} from "@/lib/utils";
import { MovementTypeBadge, StockStatusBadge } from "@/components/ui/Badge";
import {
  StockOperationModal,
  StockOperationType,
} from "@/components/stock/StockOperationModal";
import { ProductFormModal } from "@/components/products/ProductFormModal";
import { useToast } from "@/components/ui/Toast";

interface ProductDetailData {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  imageUrl: string | null;
  quantity: number;
  unit: string;
  minStockLevel: number;
  unitCost: number;
  locationCode: string | null;
  isArchived: boolean;
  categoryId: string;
  supplierId: string | null;
  stockStatus: StockStatus;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; description: string | null };
  supplier: {
    id: string;
    companyName: string;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  movements: Array<{
    id: string;
    movementCode: string;
    type: string;
    quantity: number;
    stockBefore: number;
    stockAfter: number;
    unitCost: number | null;
    reason: string | null;
    referenceNo: string | null;
    notes: string | null;
    isReversed: boolean;
    movementDate?: string;
    createdAt: string;
    user: { id: string; name: string; email: string };
    supplier: { id: string; companyName: string } | null;
  }>;
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const productId = params.id;

  const [product, setProduct] = useState<ProductDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [quickSelling, setQuickSelling] = useState(false);

  // User permissions
  const [canManageProducts, setCanManageProducts] = useState(false);
  const [canStockIn, setCanStockIn] = useState(false);
  const [canStockOut, setCanStockOut] = useState(false);
  const [canAdjustStock, setCanAdjustStock] = useState(false);

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockOpType, setStockOpType] = useState<StockOperationType>("IN");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          const isAdmin = d.user.role === "ADMIN";
          setCanManageProducts(isAdmin || d.user.permissions.canManageProducts);
          setCanStockIn(isAdmin || d.user.permissions.canStockIn);
          setCanStockOut(isAdmin || d.user.permissions.canStockOut);
          setCanAdjustStock(isAdmin || d.user.permissions.canAdjustStock);
        }
      })
      .catch(() => {});
  }, []);

  const loadProductDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}`);
      if (!res.ok) {
        router.push("/urunler");
        return;
      }
      const data = await res.json();
      setProduct(data.product);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [productId, router]);

  useEffect(() => {
    loadProductDetail();
  }, [loadProductDetail]);

  const handleQuickBoxSale = async () => {
    if (!product || quickSelling || product.quantity < 25) return;
    setQuickSelling(true);
    try {
      const res = await fetch("/api/stock/out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": `DETAIL-BOX-${product.id}-${Date.now()}`,
        },
        body: JSON.stringify({
          productId: product.id,
          quantity: 25,
          reason: "Satış",
          notes: "1 Kutu (25 Fişek) hızlı tezgah satışı",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          type: "error",
          title: "Satış Yapılamadı",
          message: data.error || "İşlem başarısız.",
        });
        return;
      }
      toast({
        type: "success",
        title: "1 Kutu (25 Fişek) Satıldı",
        message: `${product.name} stoğundan 25 adet düşüldü.`,
      });
      loadProductDetail();
    } catch {
      toast({
        type: "error",
        title: "Hata",
        message: "Sunucu bağlantı hatası.",
      });
    } finally {
      setQuickSelling(false);
    }
  };

  if (loading || !product) {
    return (
      <div className="p-16 flex flex-col items-center justify-center gap-2 text-stone-500">
        <Loader2 className="w-7 h-7 animate-spin text-[#f26522]" />
        <span className="text-xs font-medium">Ürün yükleniyor...</span>
      </div>
    );
  }

  const isShellProduct =
    product.category.name === "Fişek" || product.sku.startsWith("FSK-");

  return (
    <div className="space-y-6">
      {/* Üst Geri Dönüş ve Hızlı İşlem Butonları */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/urunler"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-[#f26522] mb-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Ürün Listesine Dön
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-stone-900">{product.name}</h1>
            <StockStatusBadge status={product.stockStatus} size="md" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canStockOut && isShellProduct && product.quantity >= 25 && (
            <button
              type="button"
              disabled={quickSelling}
              onClick={handleQuickBoxSale}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              {quickSelling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "-1 Kutu (25 Fişek) Sat"
              )}
            </button>
          )}

          {canStockIn && (
            <button
              type="button"
              onClick={() => {
                setStockOpType("IN");
                setStockModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors"
            >
              <ArrowDownLeft className="w-4 h-4" />+ Stok Girişi
            </button>
          )}

          {canStockOut && (
            <button
              type="button"
              onClick={() => {
                setStockOpType("OUT");
                setStockModalOpen(true);
              }}
              disabled={product.quantity <= 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#f26522] hover:bg-[#d95619] rounded-xl shadow-sm disabled:opacity-40 transition-colors"
            >
              <ArrowUpRight className="w-4 h-4" />- Satış / Çıkış
            </button>
          )}

          {canAdjustStock && (
            <button
              type="button"
              onClick={() => {
                setStockOpType("ADJUST");
                setStockModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl shadow-sm transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4 text-stone-500" />
              Sayım Düzelt
            </button>
          )}

          {canManageProducts && (
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-stone-700 bg-white border border-stone-200 hover:bg-stone-50 rounded-xl shadow-sm transition-colors"
            >
              <Edit2 className="w-4 h-4 text-stone-500" />
              Düzenle
            </button>
          )}
        </div>
      </div>

      {/* Ana Ürün Kartı: Görsel + Temel Rakamlar */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div className="rounded-xl overflow-hidden border border-stone-200 bg-stone-900 flex items-center justify-center h-48">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <Package className="w-12 h-12 text-stone-500" />
          )}
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
              <span className="text-xs font-semibold text-stone-500">
                Kalan Fişek / Stok Sayısı
              </span>
              <p className="text-2xl font-bold text-stone-900 mt-1">
                {formatQuantity(product.quantity, product.unit)}
              </p>
              <span className="text-[11px] text-stone-500 block mt-0.5">
                {isShellProduct
                  ? `${Math.floor(product.quantity / 25)} Kutu (${(product.quantity / 250).toFixed(1)} Koli) • Kritik Sınır: ${product.minStockLevel} Adet`
                  : `Kritik Sınır: ${formatQuantity(product.minStockLevel, product.unit)}`}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
              <span className="text-xs font-semibold text-stone-500">
                Tek Fişek / Birim Fiyatı
              </span>
              <p className="text-2xl font-bold text-stone-900 mt-1">
                {formatCurrency(product.unitCost)}
              </p>
              <span className="text-[11px] text-stone-500 block mt-0.5">
                {isShellProduct
                  ? `Kutu (25'li): ${formatCurrency(product.unitCost * 25)} • Koli (250): ${formatCurrency(product.unitCost * 250)}`
                  : `1 ${product.unit} fiyatı`}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-orange-50/60 border border-orange-200/80 col-span-2 sm:col-span-1">
              <span className="text-xs font-semibold text-[#f26522]">
                Toplam Stok Değeri
              </span>
              <p className="text-2xl font-bold text-[#f26522] mt-1">
                {formatCurrency(product.quantity * product.unitCost)}
              </p>
              <span className="text-[11px] text-stone-500">
                Kategori: {product.category.name}
              </span>
            </div>
          </div>

          <div className="text-xs text-stone-600 space-y-1 pt-2 border-t border-stone-100">
            <p>
              <strong>Stok Kodu:</strong> {product.sku}
              {product.barcode ? ` • Barkod: ${product.barcode}` : ""}
              {product.supplier ? ` • Tedarikçi: ${product.supplier.companyName}` : ""}
            </p>
            {product.description && <p>{product.description}</p>}
          </div>
        </div>
      </div>

      {/* Bu Ürünün Son Stok Hareketleri */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200/80">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
            <History className="w-4 h-4 text-[#f26522]" />
            Bu Ürünün Giriş / Çıkış Geçmişi
          </h2>
        </div>

        {product.movements.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-500">
            Bu ürün için henüz giriş veya çıkış kaydı bulunmuyor.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50/80 border-b border-stone-200/80 text-xs font-semibold text-stone-600">
                  <th className="py-3 px-4">Tarih</th>
                  <th className="py-3 px-3">İşlem</th>
                  <th className="py-3 px-3">Miktar</th>
                  <th className="py-3 px-3">Stok Değişimi</th>
                  <th className="py-3 px-3">Açıklama</th>
                  <th className="py-3 px-4">Personel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs">
                {product.movements.map((m) => (
                  <tr key={m.id} className="hover:bg-stone-50/70">
                    <td className="py-3 px-4 whitespace-nowrap text-stone-700">
                      {formatDateTR(m.movementDate || m.createdAt)}
                    </td>
                    <td className="py-3 px-3">
                      <MovementTypeBadge
                        type={m.type}
                        isReversed={m.isReversed}
                      />
                    </td>
                    <td className="py-3 px-3 font-bold">
                      <span
                        className={
                          m.type === "IN"
                            ? "text-emerald-700"
                            : m.type === "OUT"
                            ? "text-rose-700"
                            : "text-amber-700"
                        }
                      >
                        {m.type === "IN" ? "+" : m.type === "OUT" ? "-" : ""}
                        {formatQuantity(m.quantity, product.unit)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-stone-600 whitespace-nowrap">
                      {formatQuantity(m.stockBefore)} →{" "}
                      <strong className="text-stone-900">
                        {formatQuantity(m.stockAfter, product.unit)}
                      </strong>
                    </td>
                    <td className="py-3 px-3 text-stone-700">
                      {m.reason || "-"}
                      {m.notes ? ` (${m.notes})` : ""}
                    </td>
                    <td className="py-3 px-4 text-stone-600">{m.user.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <ProductFormModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        product={product}
        onSuccess={loadProductDetail}
      />

      <StockOperationModal
        open={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        operationType={stockOpType}
        preselectedProductId={product.id}
        onSuccess={loadProductDetail}
      />
    </div>
  );
}
