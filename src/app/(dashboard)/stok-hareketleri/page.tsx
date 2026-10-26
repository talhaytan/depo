"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  RotateCcw,
  Download,
  Search,
  Loader2,
  ArrowLeftRight,
} from "lucide-react";
import {
  formatCurrency,
  formatDateTR,
  formatQuantity,
  getMovementTypeLabel,
} from "@/lib/utils";
import { MovementTypeBadge } from "@/components/ui/Badge";
import {
  StockOperationModal,
  StockOperationType,
} from "@/components/stock/StockOperationModal";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { downloadCsv } from "@/lib/csv";

interface MovementRecord {
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
  movementDate: string;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    unit: string;
    imageUrl?: string | null;
  };
  user: { id: string; name: string; email: string };
  supplier: { id: string; companyName: string } | null;
}

export default function StockMovementsPage() {
  const { toast } = useToast();

  // Permissions
  const [canStockIn, setCanStockIn] = useState(false);
  const [canStockOut, setCanStockOut] = useState(false);
  const [canAdjustStock, setCanAdjustStock] = useState(false);
  const [canExportData, setCanExportData] = useState(false);

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [productId, setProductId] = useState("");
  const [userId, setUserId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Debounce searchInput -> search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 220);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Data
  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [products, setProducts] = useState<
    Array<{ id: string; name: string; sku: string }>
  >([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  // Modals
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockOpType, setStockOpType] = useState<StockOperationType>("IN");

  // Reversal Modal
  const [reversalTarget, setReversalTarget] = useState<MovementRecord | null>(
    null
  );
  const [reversalReason, setReversalReason] = useState("");
  const [reversing, setReversing] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          const isAdmin = d.user.role === "ADMIN";
          setCanStockIn(isAdmin || d.user.permissions.canStockIn);
          setCanStockOut(isAdmin || d.user.permissions.canStockOut);
          setCanAdjustStock(isAdmin || d.user.permissions.canAdjustStock);
          setCanExportData(isAdmin || d.user.permissions.canExportData);
        }
      })
      .catch(() => {});

    fetch("/api/products?pageSize=300")
      .then((r) => r.json())
      .then((d) => {
        if (d.items) setProducts(d.items);
      })
      .catch(() => {});

    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => {
        if (d.users) setUsers(d.users);
      })
      .catch(() => {});
  }, []);

  const fetchMovements = useCallback(async () => {
    setFetching(true);
    try {
      const qs = new URLSearchParams({
        search,
        type: typeFilter,
        productId,
        userId,
        startDate,
        endDate,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/movements?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMovements(data.items || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch {
      toast({
        type: "error",
        title: "Hata",
        message: "Stok hareketleri yüklenirken hata oluştu.",
      });
    } finally {
      setFetching(false);
      setInitialLoading(false);
    }
  }, [
    search,
    typeFilter,
    productId,
    userId,
    startDate,
    endDate,
    page,
    pageSize,
    toast,
  ]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  const handleReverseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalTarget || reversing) return;
    setReversing(true);
    try {
      const res = await fetch("/api/stock/reverse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movementId: reversalTarget.id,
          reason: reversalReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          type: "error",
          title: "Ters Kayıt Başarısız",
          message: data.error || "İşlem iptal edilemedi.",
        });
        return;
      }

      toast({
        type: "success",
        title: "Ters Kayıt Oluşturuldu",
        message: `${reversalTarget.movementCode} hareketi iptal edildi ve denetim izi kaydedildi.`,
      });
      setReversalTarget(null);
      setReversalReason("");
      fetchMovements();
    } catch {
      toast({
        type: "error",
        title: "Hata",
        message: "Sunucu bağlantı hatası.",
      });
    } finally {
      setReversing(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const qs = new URLSearchParams({
        search,
        type: typeFilter,
        productId,
        userId,
        startDate,
        endDate,
        page: "1",
        pageSize: "500",
      });
      const res = await fetch(`/api/movements?${qs.toString()}`);
      const data = await res.json();
      const items: MovementRecord[] = data.items || [];

      downloadCsv(
        `depo-stok-hareketleri-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          "Hareket Kodu",
          "Tarih ve Saat",
          "Ürün Adı",
          "Stok Kodu (SKU)",
          "İşlem Türü",
          "Miktar",
          "Birim",
          "Önceki Stok",
          "Sonraki Stok",
          "Birim Maliyet (TRY)",
          "İşlem Nedeni",
          "Belge / Referans No",
          "Tedarikçi",
          "İşlemi Yapan Personel",
        ],
        items.map((m) => [
          m.movementCode,
          formatDateTR(m.movementDate || m.createdAt),
          m.product.name,
          m.product.sku,
          getMovementTypeLabel(m.type),
          m.quantity,
          m.product.unit,
          m.stockBefore,
          m.stockAfter,
          m.unitCost !== null ? (m.unitCost ?? 0).toFixed(2) : "-",
          m.reason || "-",
          m.referenceNo || "-",
          m.supplier?.companyName || "-",
          m.user.name,
        ])
      );

      toast({
        type: "success",
        title: "CSV İndirildi",
        message: `${items.length} stok hareketi dışa aktarıldı.`,
      });
    } catch {
      toast({
        type: "error",
        title: "Hata",
        message: "CSV dışa aktarma sırasında hata oluştu.",
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Stok Hareketleri
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Değiştirilemez (immutable) stok giriş, çıkış, sayım düzeltme ve ters kayıt geçmişi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canStockIn && (
            <button
              type="button"
              onClick={() => {
                setStockOpType("IN");
                setStockModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors"
            >
              <ArrowDownLeft className="w-4 h-4" />
              Stok Girişi Yap
            </button>
          )}

          {canStockOut && (
            <button
              type="button"
              onClick={() => {
                setStockOpType("OUT");
                setStockModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-[#f26522] hover:bg-[#d95619] rounded-xl shadow-sm transition-colors"
            >
              <ArrowUpRight className="w-4 h-4" />
              Stok Çıkışı Yap
            </button>
          )}

          {canAdjustStock && (
            <button
              type="button"
              onClick={() => {
                setStockOpType("ADJUST");
                setStockModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl shadow-sm transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4 text-stone-500" />
              Sayım Düzeltme
            </button>
          )}

          {canExportData && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-stone-700 bg-white border border-stone-200 hover:bg-stone-50 rounded-xl shadow-sm transition-colors"
            >
              <Download className="w-4 h-4 text-stone-500" />
              CSV Dışa Aktar
            </button>
          )}
        </div>
      </div>

      {/* Quick Type Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { value: "", label: "Tümü" },
          { value: "IN", label: "Stok Girişleri" },
          { value: "OUT", label: "Satış / Stok Çıkışları" },
          { value: "ADJUSTMENT", label: "Sayım Düzeltmeleri" },
          { value: "REVERSAL", label: "Ters Kayıtlar (İptal)" },
        ].map((pill) => (
          <button
            key={pill.value}
            type="button"
            onClick={() => {
              setTypeFilter(pill.value);
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              typeFilter === pill.value
                ? "bg-[#f26522] text-white shadow-sm"
                : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
              placeholder="Hareket kodu, ürün, belge no veya neden ara..."
              className="w-full pl-10 pr-8 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-[#f26522]"
            />
            {fetching && (
              <Loader2 className="w-4 h-4 text-[#f26522] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              aria-label="İşlem Türü"
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl bg-white"
            >
              <option value="">Tüm İşlem Türleri</option>
              <option value="IN">Stok Girişi</option>
              <option value="OUT">Stok Çıkışı</option>
              <option value="ADJUSTMENT">Stok Düzeltme</option>
              <option value="REVERSAL">Ters Kayıt (İptal)</option>
            </select>
          </div>

          <div>
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setPage(1);
              }}
              aria-label="Ürüne Göre Filtrele"
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl bg-white"
            >
              <option value="">Tüm Ürünler</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.sku}] {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setPage(1);
              }}
              aria-label="Personele Göre Filtrele"
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl bg-white"
            >
              <option value="">Tüm Personeller</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              title="Başlangıç Tarihi"
              className="w-full px-2.5 py-2 text-xs border border-stone-200 rounded-xl"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              title="Bitiş Tarihi"
              className="w-full px-2.5 py-2 text-xs border border-stone-200 rounded-xl"
            />
          </div>
        </div>

        {(searchInput ||
          typeFilter ||
          productId ||
          userId ||
          startDate ||
          endDate) && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setTypeFilter("");
                setProductId("");
                setUserId("");
                setStartDate("");
                setEndDate("");
                setPage(1);
              }}
              className="text-xs font-semibold text-[#f26522] hover:text-[#d95619]"
            >
              Filtreleri Sıfırla
            </button>
          </div>
        )}
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
        {initialLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2 text-stone-500">
            <Loader2 className="w-6 h-6 animate-spin text-[#f26522]" />
            <span className="text-xs font-medium">
              Stok hareketleri yükleniyor...
            </span>
          </div>
        ) : movements.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center mx-auto mb-3">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-stone-900">
              Eşleşen stok hareketi bulunamadı
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Seçili filtre kriterlerine uygun stok giriş veya çıkış kaydı yok.
            </p>
          </div>
        ) : (
          <>
            {/* MOBİL HAREKET KART LİSTESİ (md:hidden) */}
            <div className="md:hidden divide-y divide-stone-200/80">
              {movements.map((m) => (
                <div
                  key={m.id}
                  className={`p-4 space-y-2.5 ${
                    m.isReversed ? "bg-stone-50/60 opacity-75" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {m.product.imageUrl && (
                        <img
                          src={m.product.imageUrl}
                          alt={m.product.name}
                          className="w-10 h-10 rounded-lg object-cover border border-stone-200 shrink-0 bg-stone-900"
                        />
                      )}
                      <div className="min-w-0">
                        <Link
                          href={`/urunler/${m.product.id}`}
                          className="text-xs font-bold text-stone-900 hover:text-[#f26522] block truncate"
                        >
                          {m.product.name}
                        </Link>
                        <span className="text-[10px] text-stone-400 font-mono block">
                          SKU: {m.product.sku} • {m.movementCode}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-sm font-bold block ${
                          m.type === "IN"
                            ? "text-emerald-700"
                            : m.type === "OUT"
                            ? "text-rose-700"
                            : "text-amber-700"
                        }`}
                      >
                        {m.type === "IN" ? "+" : m.type === "OUT" ? "-" : ""}
                        {formatQuantity(m.quantity, m.product.unit)}
                      </span>
                      <MovementTypeBadge
                        type={m.type}
                        isReversed={m.isReversed}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] bg-stone-50 px-3 py-2 rounded-xl border border-stone-200/60">
                    <span className="text-stone-600">
                      Stok:{" "}
                      <strong>
                        {formatQuantity(m.stockBefore)} →{" "}
                        {formatQuantity(m.stockAfter, m.product.unit)}
                      </strong>
                    </span>
                    <span className="text-stone-500">
                      {formatDateTR(m.movementDate || m.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px] text-stone-500">
                    <span className="truncate">
                      {m.reason || "Standart işlem"} • {m.user.name}
                    </span>

                    {canAdjustStock &&
                      !m.isReversed &&
                      m.type !== "REVERSAL" && (
                        <button
                          type="button"
                          onClick={() => {
                            setReversalTarget(m);
                            setReversalReason("");
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-stone-700 bg-white border border-stone-200 rounded-lg shrink-0"
                        >
                          <RotateCcw className="w-3 h-3 text-stone-500" />
                          Ters Kayıt
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>

            {/* MASAÜSTÜ TABLO GÖRÜNÜMÜ (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/80 border-b border-stone-200/80 text-[11px] font-semibold text-stone-500 uppercase">
                    <th className="py-3.5 px-4">Tarih / Hareket Kodu</th>
                    <th className="py-3.5 px-3">Ürün Adı & SKU</th>
                    <th className="py-3.5 px-3">Hareket Türü</th>
                    <th className="py-3.5 px-3">Miktar</th>
                    <th className="py-3.5 px-3">Önceki → Sonraki</th>
                    <th className="py-3.5 px-3">Neden & Referans No</th>
                    <th className="py-3.5 px-3">İşlemi Yapan</th>
                    <th className="py-3.5 px-4 text-right">Düzeltme</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs">
                  {movements.map((m) => (
                    <tr
                      key={m.id}
                      className={`hover:bg-stone-50/70 transition-colors ${
                        m.isReversed ? "bg-stone-50/50 opacity-75" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-medium text-stone-900 block">
                          {formatDateTR(m.movementDate || m.createdAt)}
                        </span>
                        <span className="text-[11px] text-stone-400 font-mono">
                          {m.movementCode}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          {m.product.imageUrl && (
                            <img
                              src={m.product.imageUrl}
                              alt={m.product.name}
                              className="w-8 h-8 rounded-lg object-cover border border-stone-200 shrink-0 bg-stone-50"
                            />
                          )}
                          <div className="min-w-0">
                            <Link
                              href={`/urunler/${m.product.id}`}
                              className="font-semibold text-stone-900 hover:text-[#f26522] block truncate"
                            >
                              {m.product.name}
                            </Link>
                            <span className="text-[11px] text-stone-500 font-mono">
                              SKU: {m.product.sku}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <MovementTypeBadge
                          type={m.type}
                          isReversed={m.isReversed}
                        />
                        {m.isReversed && (
                          <span className="block text-[10px] text-rose-600 font-semibold mt-0.5">
                            Ters Kayıt İle İptal Edildi
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap font-bold">
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
                          {formatQuantity(m.quantity, m.product.unit)}
                        </span>
                        {m.unitCost !== null && m.type === "IN" && (
                          <span className="block text-[11px] text-stone-500 font-normal">
                            Birim: {formatCurrency(m.unitCost)}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap text-stone-700">
                        {formatQuantity(m.stockBefore)} →{" "}
                        <strong className="text-stone-900">
                          {formatQuantity(m.stockAfter, m.product.unit)}
                        </strong>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="font-medium text-stone-800 block">
                          {m.reason || "-"}
                        </span>
                        {m.referenceNo && (
                          <span className="text-[11px] text-stone-500 font-mono block">
                            Belge No: {m.referenceNo}
                          </span>
                        )}
                        {m.supplier && (
                          <span className="text-[11px] text-stone-500 block">
                            Tedarikçi: {m.supplier.companyName}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-stone-700">
                        {m.user.name}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {canAdjustStock &&
                          !m.isReversed &&
                          m.type !== "REVERSAL" && (
                            <button
                              type="button"
                              onClick={() => {
                                setReversalTarget(m);
                                setReversalReason("");
                              }}
                              title="Hatalı İşlemi Ters Kayıt İle İptal Et"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50 rounded-lg"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
                              Ters Kayıt
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 bg-stone-50/80 border-t border-stone-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-stone-600">
              <div className="flex items-center gap-3">
                <span>
                  Toplam <strong>{total}</strong> hareket kaydı
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  aria-label="Sayfa boyutu"
                  className="px-2 py-1 border border-stone-200 rounded-lg bg-white"
                >
                  <option value={15}>15 / sayfa</option>
                  <option value={20}>20 / sayfa</option>
                  <option value={50}>50 / sayfa</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 font-medium"
                >
                  Önceki
                </button>
                <span className="px-2 font-semibold text-stone-800">
                  Sayfa {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 font-medium"
                >
                  Sonraki
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Stock Operation Modal */}
      <StockOperationModal
        open={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        operationType={stockOpType}
        onSuccess={fetchMovements}
      />

      {/* Reversal Confirmation Modal */}
      <Modal
        open={Boolean(reversalTarget)}
        onClose={() => setReversalTarget(null)}
        title="Stok Hareketini Ters Kayıt İle İptal Et"
        description="Stok hareketleri değiştirilemez (immutable) ticari kayıtlardır. Bu işlem orijinal kaydı silmez; stoğu eski haline getiren yeni bir Ters Kayıt hareketi ve denetim izi oluşturur."
        maxWidth="md"
      >
        {reversalTarget && (
          <form onSubmit={handleReverseSubmit} className="space-y-4">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
              <p>
                <span className="text-slate-500">Hareket Kodu:</span>{" "}
                <strong className="font-mono text-slate-900">
                  {reversalTarget.movementCode}
                </strong>
              </p>
              <p>
                <span className="text-slate-500">Ürün:</span>{" "}
                <strong className="text-slate-900">
                  {reversalTarget.product.name} ({reversalTarget.product.sku})
                </strong>
              </p>
              <p>
                <span className="text-slate-500">İşlem Miktarı:</span>{" "}
                <strong className="text-slate-900">
                  {formatQuantity(
                    reversalTarget.quantity,
                    reversalTarget.product.unit
                  )}
                </strong>{" "}
                ({reversalTarget.stockBefore} → {reversalTarget.stockAfter})
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                İptal / Ters Kayıt Nedeni *
              </label>
              <textarea
                required
                rows={3}
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="Örn: Yanlış ürün seçimi veya hatalı adet girişi nedeniyle iptal edildi..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReversalTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={reversing}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm disabled:opacity-50"
              >
                {reversing && <Loader2 className="w-4 h-4 animate-spin" />}
                Ters Kayıt Oluştur
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
