"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  Download,
  ArrowUpDown,
  Edit2,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  Loader2,
  Filter,
  Zap,
} from "lucide-react";
import {
  formatCurrency,
  formatQuantity,
  getStockStatusLabel,
  StockStatus,
} from "@/lib/utils";
import { StockStatusBadge } from "@/components/ui/Badge";
import {
  ProductFormModal,
  EditableProduct,
} from "@/components/products/ProductFormModal";
import {
  StockOperationModal,
  StockOperationType,
} from "@/components/stock/StockOperationModal";
import { downloadCsv } from "@/lib/csv";
import { useToast } from "@/components/ui/Toast";

interface ProductRow {
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
  isArchived: boolean;
  categoryId: string;
  supplierId: string | null;
  category: { id: string; name: string };
  supplier: { id: string; companyName: string } | null;
  stockStatus: StockStatus;
  createdAt: string;
  updatedAt: string;
}

function ProductsContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Permissions
  const [canManageProducts, setCanManageProducts] = useState(false);
  const [canStockIn, setCanStockIn] = useState(false);
  const [canStockOut, setCanStockOut] = useState(false);
  const [canExportData, setCanExportData] = useState(false);

  // Filters & Pagination
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [categoryId, setCategoryId] = useState(
    searchParams.get("categoryId") || ""
  );
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || ""
  );
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [quickSellingId, setQuickSellingId] = useState<string | null>(null);

  // Modals
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<EditableProduct | null>(null);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockOpType, setStockOpType] = useState<StockOperationType>("IN");
  const [selectedProdId, setSelectedProdId] = useState<string | undefined>(
    undefined
  );

  // Sync URL query params whenever user navigates from top search bar or dashboard cards
  useEffect(() => {
    const urlSearch = searchParams.get("search") ?? "";
    const urlCat = searchParams.get("categoryId") ?? "";
    const urlStatus = searchParams.get("status") ?? "";
    setSearch(urlSearch);
    setDebouncedSearch(urlSearch);
    setCategoryId(urlCat);
    setStatusFilter(urlStatus);
    setPage(1);
  }, [searchParams]);

  // Debounce search input by 220ms so typing doesn't spam API or cause table flicker
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 220);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          const isAdmin = d.user.role === "ADMIN";
          setCanManageProducts(isAdmin || d.user.permissions.canManageProducts);
          setCanStockIn(isAdmin || d.user.permissions.canStockIn);
          setCanStockOut(isAdmin || d.user.permissions.canStockOut);
          setCanExportData(isAdmin || d.user.permissions.canExportData);
        }
      })
      .catch(() => {});

    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => {
        if (d.categories) setCategories(d.categories);
      })
      .catch(() => {});
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        search: debouncedSearch,
        categoryId,
        status: statusFilter,
        archived: "false",
        sortBy,
        sortDir,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/products?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.items || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch {
      toast({
        type: "error",
        title: "Hata",
        message: "Ürün listesi yüklenirken bir hata oluştu.",
      });
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearch,
    categoryId,
    statusFilter,
    sortBy,
    sortDir,
    page,
    pageSize,
    toast,
  ]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  // 1-Click Quick Counter Sale of 1 Box (25 shells)
  const handleQuickBoxSale = async (product: ProductRow) => {
    if (quickSellingId || product.quantity < 25) return;
    setQuickSellingId(product.id);
    try {
      const res = await fetch("/api/stock/out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity: 25,
          reason: "Satış (Ruhsatlı / Perakende)",
          notes: "Hızlı Satış: 1 Kutu (25 Adet Fişek)",
          idempotencyKey: `QUICK25-${product.id}-${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          type: "error",
          title: "İşlem Başarısız",
          message: data.error || "Satış kaydedilemedi.",
        });
        return;
      }
      toast({
        type: "success",
        title: "1 Kutu (25 Fişek) Satışı Kaydedildi",
        message: `${product.name} — Kalan: ${formatQuantity(
          data.movement?.stockAfter,
          product.unit
        )}`,
      });
      fetchProducts();
    } catch {
      toast({
        type: "error",
        title: "Bağlantı Hatası",
        message: "Sunucuya ulaşılamadı.",
      });
    } finally {
      setQuickSellingId(null);
    }
  };

  const handleExportCsv = async () => {
    try {
      const qs = new URLSearchParams({
        search: debouncedSearch,
        categoryId,
        status: statusFilter,
        archived: "false",
        sortBy,
        sortDir,
        page: "1",
        pageSize: "500",
      });
      const res = await fetch(`/api/products?${qs.toString()}`);
      const data = await res.json();
      const items: ProductRow[] = data.items || [];

      downloadCsv(
        `cavus-av-bayii-stok-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          "Ürün Adı",
          "Kategori",
          "Mevcut Stok",
          "Birim",
          "Stok Durumu",
          "Birim Fiyat / Maliyet (TRY)",
          "Stok Kodu",
        ],
        items.map((p) => [
          p.name,
          p.category.name,
          p.quantity,
          p.unit,
          getStockStatusLabel(p.stockStatus),
          p.unitCost.toFixed(2),
          p.sku,
        ])
      );

      toast({
        type: "success",
        title: "Excel / CSV İndirildi",
        message: `${items.length} ürün dışa aktarıldı.`,
      });
    } catch {
      toast({
        type: "error",
        title: "Hata",
        message: "CSV oluşturulurken bir hata oluştu.",
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Başlık ve Ana Butonlar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Ürünler ve Fişek Envanteri ({total})
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            Stok eklemek için yeşil <strong>(+ Giriş)</strong>, satış için{" "}
            <strong>(-1 Kutu)</strong> veya <strong>(- Çıkış)</strong> butonunu
            kullanın.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canExportData && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-stone-700 bg-white border border-stone-200/90 hover:bg-stone-50 rounded-xl shadow-2xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-stone-500" />
              Excel / CSV İndir
            </button>
          )}

          {canManageProducts && (
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setProductModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#f26522] hover:bg-[#dd5616] rounded-xl shadow-xs cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              Yeni Ürün Ekle
            </button>
          )}
        </div>
      </div>

      {/* Hızlı Kategori Seçim Sekmeleri + Arama */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3.5">
        {/* Kategori Butonları (Mobilde yatay kaydırılabilir) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1">
            <button
              type="button"
              onClick={() => {
                setCategoryId("");
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                categoryId === ""
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              Tümü
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCategoryId(c.id);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                  categoryId === c.id
                    ? "bg-[#f26522] text-white"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Hızlı Stok Durumu Hapları */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
            {[
              { label: "Tüm Stok", val: "" },
              { label: "Kritik Stok", val: "LOW_STOCK" },
              { label: "Stokta Yok", val: "OUT_OF_STOCK" },
            ].map((st) => (
              <button
                key={st.val}
                type="button"
                onClick={() => {
                  setStatusFilter(st.val);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer shrink-0 ${
                  statusFilter === st.val
                    ? "bg-orange-50 border-[#f26522] text-[#f26522]"
                    : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Arama Çubuğu */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Marka, model, gramaj veya saçma numarası ara (Örn: Sterling, RC Sipe, 32gr)..."
              className="w-full pl-10 pr-10 py-2.5 sm:py-2 text-sm bg-[#f8f6f2] border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522] transition-all"
            />
            {loading && (
              <Loader2 className="w-4 h-4 animate-spin text-[#f26522] absolute right-3.5 top-1/2 -translate-y-1/2" />
            )}
          </div>

          {(search || categoryId || statusFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setDebouncedSearch("");
                setCategoryId("");
                setStatusFilter("");
                setPage(1);
              }}
              className="px-3.5 py-2 text-xs font-semibold text-[#f26522] hover:bg-orange-50 rounded-xl cursor-pointer"
            >
              Filtreyi Temizle
            </button>
          )}
        </div>
      </div>

      {/* Ürün Listesi: Mobilde Kart Görünümü (md:hidden), Masaüstünde Tablo (hidden md:block) */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
        {loading && products.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-stone-500 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#f26522]" />
            <span className="text-xs font-medium">Yükleniyor...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-10 h-10 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center mx-auto mb-2">
              <Filter className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-stone-900">
              Ürün bulunamadı
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Arama kelimesini veya filtreyi değiştirip tekrar deneyin.
            </p>
          </div>
        ) : (
          <>
            {/* MOBİL KART LİSTESİ (md:hidden) */}
            <div className="md:hidden divide-y divide-stone-200/80">
              {products.map((p) => {
                const isShell =
                  p.category.name === "Fişek" || p.sku.startsWith("FSK-");
                return (
                  <div key={p.id} className="p-4 space-y-3">
                    {/* Üst Satır: Görsel + Ürün Adı + Stok Durumu */}
                    <div className="flex items-start gap-3">
                      <Link
                        href={`/urunler/${p.id}`}
                        className="w-20 h-14 rounded-xl border border-stone-200 bg-stone-900 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs"
                      >
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-stone-400" />
                        )}
                      </Link>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/urunler/${p.id}`}
                            className="text-sm font-bold text-stone-900 hover:text-[#f26522] leading-snug line-clamp-2"
                          >
                            {p.name}
                          </Link>
                          <StockStatusBadge status={p.stockStatus} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[11px] text-stone-400 font-mono">
                            SKU: {p.sku}
                          </span>
                          <span className="inline-flex px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-semibold">
                            {p.category.name}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Orta Satır: Stok ve Fiyat Kutuları */}
                    <div className="grid grid-cols-2 gap-2.5 bg-[#faf9f6] p-2.5 rounded-xl border border-stone-200/70">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 block">
                          Kalan Stok
                        </span>
                        <span className="text-sm font-bold text-stone-900">
                          {formatQuantity(p.quantity, "Adet")}
                        </span>
                        {isShell && p.quantity > 0 && (
                          <span className="block text-[10px] text-stone-500">
                            {Math.floor(p.quantity / 25)} Kutu •{" "}
                            {(p.quantity / 250).toFixed(1)} Koli
                          </span>
                        )}
                      </div>

                      <div className="border-l border-stone-200/70 pl-2.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 block">
                          Birim Fiyat
                        </span>
                        <span className="text-sm font-bold text-stone-900">
                          {formatCurrency(p.unitCost)}{" "}
                          <span className="text-[10px] font-normal text-stone-500">
                            / Adet
                          </span>
                        </span>
                        {isShell && (
                          <span className="block text-[10px] text-stone-500">
                            Kutu: {formatCurrency(p.unitCost * 25)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Alt Satır: Dokunmatik Hızlı İşlem Butonları */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {canStockOut && isShell && p.quantity >= 25 && (
                        <button
                          type="button"
                          disabled={quickSellingId === p.id}
                          onClick={() => handleQuickBoxSale(p)}
                          className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-2.5 text-xs font-bold text-amber-900 bg-amber-50 active:bg-amber-100 border border-amber-200 rounded-xl transition-colors disabled:opacity-40"
                        >
                          {quickSellingId === p.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Zap className="w-3.5 h-3.5 text-[#f26522]" />
                          )}
                          -1 Kutu (25)
                        </button>
                      )}

                      {canStockIn && (
                        <button
                          type="button"
                          onClick={() => {
                            setStockOpType("IN");
                            setSelectedProdId(p.id);
                            setStockModalOpen(true);
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 active:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5" />+ Giriş
                        </button>
                      )}

                      {canStockOut && (
                        <button
                          type="button"
                          onClick={() => {
                            setStockOpType("OUT");
                            setSelectedProdId(p.id);
                            setStockModalOpen(true);
                          }}
                          disabled={p.quantity <= 0}
                          className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-2.5 text-xs font-bold text-rose-700 bg-rose-50 active:bg-rose-100 border border-rose-200 rounded-xl transition-colors disabled:opacity-40"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />- Çıkış
                        </button>
                      )}

                      {canManageProducts && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProduct(p);
                            setProductModalOpen(true);
                          }}
                          title="Düzenle"
                          className="p-2 text-stone-600 bg-stone-100 active:bg-stone-200 rounded-xl"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* MASAÜSTÜ TABLO GÖRÜNÜMÜ (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#faf9f6] border-b border-stone-200/80 text-xs font-semibold text-stone-500">
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => toggleSort("name")}
                        className="inline-flex items-center gap-1 hover:text-stone-900 cursor-pointer"
                      >
                        Ürün <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>
                    <th className="py-3 px-3">Kategori</th>
                    <th className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("unitCost")}
                        className="inline-flex items-center gap-1 hover:text-stone-900 cursor-pointer"
                      >
                        Fişek / Birim Fiyatı{" "}
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>
                    <th className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("quantity")}
                        className="inline-flex items-center gap-1 hover:text-stone-900 cursor-pointer"
                      >
                        Kalan Fişek / Stok{" "}
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>
                    <th className="py-3 px-4 text-right">Hızlı Stok İşlemi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-sm">
                  {products.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-stone-50/80 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3.5">
                          <Link
                            href={`/urunler/${p.id}`}
                            className="w-20 h-14 rounded-xl border border-stone-200 bg-stone-900 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs"
                          >
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-stone-400" />
                            )}
                          </Link>
                          <div className="min-w-0">
                            <Link
                              href={`/urunler/${p.id}`}
                              className="font-semibold text-stone-900 hover:text-[#f26522] block transition-colors"
                            >
                              {p.name}
                            </Link>
                            <span className="text-xs text-stone-400 font-mono">
                              SKU: {p.sku}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="inline-flex px-2.5 py-0.5 rounded-lg bg-stone-100 text-stone-700 text-xs font-medium">
                          {p.category.name}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-semibold text-stone-900">
                        {formatCurrency(p.unitCost)}{" "}
                        <span className="text-xs font-normal text-stone-500">
                          / Adet
                        </span>
                        {p.category.name === "Fişek" && (
                          <span className="block text-[11px] text-stone-400 font-normal">
                            Kutu (25&apos;li): {formatCurrency(p.unitCost * 25)}{" "}
                            • Koli (250): {formatCurrency(p.unitCost * 250)}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-stone-900">
                            {formatQuantity(p.quantity, "Adet")}
                          </span>
                          <StockStatusBadge status={p.stockStatus} />
                        </div>
                        {p.category.name === "Fişek" && p.quantity > 0 && (
                          <span className="block text-[11px] text-stone-400 mt-0.5">
                            ({Math.floor(p.quantity / 25)} Kutu /{" "}
                            {(p.quantity / 250).toFixed(1)} Koli)
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {/* 1-Click 1 Box (25 shells) Quick Counter Sale */}
                          {canStockOut &&
                            p.category.name === "Fişek" &&
                            p.quantity >= 25 && (
                              <button
                                type="button"
                                disabled={quickSellingId === p.id}
                                onClick={() => handleQuickBoxSale(p)}
                                title="Tek tıkla 1 Kutu (25 Fişek) satış düş"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                              >
                                {quickSellingId === p.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Zap className="w-3.5 h-3.5 text-[#f26522]" />
                                )}
                                -1 Kutu (25)
                              </button>
                            )}

                          {canStockIn && (
                            <button
                              type="button"
                              onClick={() => {
                                setStockOpType("IN");
                                setSelectedProdId(p.id);
                                setStockModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5" />+ Giriş
                            </button>
                          )}

                          {canStockOut && (
                            <button
                              type="button"
                              onClick={() => {
                                setStockOpType("OUT");
                                setSelectedProdId(p.id);
                                setStockModalOpen(true);
                              }}
                              disabled={p.quantity <= 0}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />- Çıkış
                            </button>
                          )}

                          {canManageProducts && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProduct(p);
                                setProductModalOpen(true);
                              }}
                              title="Düzenle"
                              className="p-1.5 text-stone-500 hover:text-[#f26522] hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sayfalama */}
            {totalPages > 1 && (
              <div className="px-4 py-3 bg-[#faf9f6] border-t border-stone-200/80 flex items-center justify-between text-xs text-stone-600">
                <span>
                  Toplam <strong>{total}</strong> ürün
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-40 font-medium cursor-pointer"
                  >
                    Önceki
                  </button>
                  <span className="px-2 font-semibold text-stone-800">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-40 font-medium cursor-pointer"
                  >
                    Sonraki
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <ProductFormModal
        open={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        product={editingProduct}
        onSuccess={fetchProducts}
      />

      <StockOperationModal
        open={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        operationType={stockOpType}
        preselectedProductId={selectedProdId}
        onSuccess={fetchProducts}
      />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#f26522]" />
        </div>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}
