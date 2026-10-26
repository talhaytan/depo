"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Download,
  BarChart3,
  AlertTriangle,
  XCircle,
  ArrowLeftRight,
  Users,
  Wallet,
  Package,
  Info,
  Loader2,
  History,
} from "lucide-react";
import {
  formatCurrency,
  formatDateTR,
  formatQuantity,
  getMovementTypeLabel,
  getStockStatusLabel,
  StockStatus,
} from "@/lib/utils";
import { MovementTypeBadge, StockStatusBadge } from "@/components/ui/Badge";
import { downloadCsv } from "@/lib/csv";
import { useToast } from "@/components/ui/Toast";

type ReportTab =
  | "CURRENT_INVENTORY"
  | "LOW_STOCK"
  | "OUT_OF_STOCK"
  | "ACTIVITY"
  | "PRODUCT_HISTORY"
  | "VALUATION"
  | "EMPLOYEE";

interface InventoryReportItem {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  categoryName: string;
  supplierName: string;
  unit: string;
  quantity: number;
  minStockLevel: number;
  unitCost: number;
  totalCostValue: number;
  status: StockStatus;
  updatedAt: string;
}

interface ReportData {
  valuationMethodology: string;
  summary: {
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalInventoryValuation: number;
    totalStockInCount: number;
    totalStockInQty: number;
    totalStockInCost: number;
    totalStockOutCount: number;
    totalStockOutQty: number;
    totalAdjustmentCount: number;
  };
  currentInventory: InventoryReportItem[];
  lowStockProducts: InventoryReportItem[];
  outOfStockProducts: InventoryReportItem[];
  categoryValuation: Array<{
    categoryName: string;
    productCount: number;
    totalQuantity: number;
    totalValuation: number;
  }>;
  movements: Array<{
    id: string;
    movementCode: string;
    type: string;
    quantity: number;
    stockBefore: number;
    stockAfter: number;
    unitCost: number;
    reason: string | null;
    referenceNo: string | null;
    createdAt: string;
    isReversed: boolean;
    product: { id: string; name: string; sku: string; unit: string };
    user: { id: string; name: string; email: string; role: string };
  }>;
  employeeActivity: Array<{
    userId: string;
    name: string;
    email: string;
    role: string;
    stockInCount: number;
    stockOutCount: number;
    adjustmentCount: number;
    reversalCount: number;
    totalOperations: number;
    lastOperationAt: string | null;
  }>;
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ReportTab>("CURRENT_INVENTORY");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [productId, setProductId] = useState("");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setAccessDenied(false);
    try {
      const qs = new URLSearchParams({
        startDate,
        endDate,
        productId,
      });
      const res = await fetch(`/api/reports?${qs.toString()}`);
      if (res.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      toast({
        type: "error",
        title: "Rapor Hatası",
        message: "Rapor verileri alınamadı.",
      });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, productId, toast]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const exportActiveReportCsv = () => {
    if (!data) return;

    if (
      activeTab === "CURRENT_INVENTORY" ||
      activeTab === "LOW_STOCK" ||
      activeTab === "OUT_OF_STOCK"
    ) {
      const list =
        activeTab === "CURRENT_INVENTORY"
          ? data.currentInventory
          : activeTab === "LOW_STOCK"
          ? data.lowStockProducts
          : data.outOfStockProducts;

      downloadCsv(
        `depo-rapor-${activeTab.toLowerCase()}-${new Date()
          .toISOString()
          .slice(0, 10)}.csv`,
        [
          "Stok Kodu (SKU)",
          "Barkod",
          "Ürün Adı",
          "Kategori",
          "Tedarikçi",
          "Mevcut Stok",
          "Birim",
          "Kritik Eşik",
          "Stok Durumu",
          "Kayıtlı Birim Alış Maliyeti (TRY)",
          "Toplam Envanter Değeri (TRY)",
        ],
        list.map((i) => [
          i.sku,
          i.barcode || "-",
          i.name,
          i.categoryName,
          i.supplierName,
          i.quantity,
          i.unit,
          i.minStockLevel,
          getStockStatusLabel(i.status),
          i.unitCost.toFixed(2),
          i.totalCostValue.toFixed(2),
        ])
      );
    } else if (activeTab === "VALUATION") {
      downloadCsv(
        `depo-envanter-degerleme-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          "Kategori",
          "Ürün Çeşidi Sayısı",
          "Toplam Stok Miktarı",
          "Toplam Alış Maliyeti Değerlemesi (TRY)",
        ],
        data.categoryValuation.map((c) => [
          c.categoryName,
          c.productCount,
          c.totalQuantity,
          c.totalValuation.toFixed(2),
        ])
      );
    } else if (activeTab === "EMPLOYEE") {
      downloadCsv(
        `depo-personel-aktivite-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          "Personel Adı",
          "E-Posta",
          "Rol",
          "Stok Giriş İşlemi",
          "Stok Çıkış İşlemi",
          "Sayım Düzeltme İşlemi",
          "Ters Kayıt İşlemi",
          "Toplam İşlem Sayısı",
          "Son İşlem Tarihi",
        ],
        data.employeeActivity.map((e) => [
          e.name,
          e.email,
          e.role === "ADMIN" ? "Yönetici" : "Personel",
          e.stockInCount,
          e.stockOutCount,
          e.adjustmentCount,
          e.reversalCount,
          e.totalOperations,
          formatDateTR(e.lastOperationAt),
        ])
      );
    } else {
      downloadCsv(
        `depo-hareket-raporu-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          "Hareket Kodu",
          "Tarih",
          "Ürün",
          "SKU",
          "Tür",
          "Miktar",
          "Önceki Stok",
          "Sonraki Stok",
          "Birim Maliyet (TRY)",
          "Neden",
          "Belge No",
          "Personel",
        ],
        data.movements.map((m) => [
          m.movementCode,
          formatDateTR(m.createdAt),
          m.product.name,
          m.product.sku,
          getMovementTypeLabel(m.type),
          m.quantity,
          m.stockBefore,
          m.stockAfter,
          (m.unitCost ?? 0).toFixed(2),
          m.reason || "-",
          m.referenceNo || "-",
          m.user.name,
        ])
      );
    }

    toast({
      type: "success",
      title: "Rapor CSV Olarak İndirildi",
      message: "Seçili rapor tablosu başarıyla dışa aktarıldı.",
    });
  };

  if (accessDenied) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-stone-200/80 text-center">
        <h2 className="text-lg font-bold text-stone-900">
          Rapor Görüntüleme Yetkiniz Bulunmamaktadır
        </h2>
        <p className="text-xs text-stone-500 mt-1">
          Raporlar modülüne erişmek için Sistem Yöneticisinden yetki talep ediniz.
        </p>
      </div>
    );
  }

  const tabs: Array<{ id: ReportTab; label: string; icon: React.ElementType }> = [
    { id: "CURRENT_INVENTORY", label: "Mevcut Envanter", icon: Package },
    { id: "LOW_STOCK", label: "Kritik Stoktakiler", icon: AlertTriangle },
    { id: "OUT_OF_STOCK", label: "Stokta Olmayanlar", icon: XCircle },
    { id: "VALUATION", label: "Envanter Değeri", icon: Wallet },
    { id: "ACTIVITY", label: "Giriş / Çıkış Özeti", icon: ArrowLeftRight },
    { id: "PRODUCT_HISTORY", label: "Ürün Hareket Geçmişi", icon: History },
    { id: "EMPLOYEE", label: "Personel Aktivitesi", icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#f26522]" />
            Raporlar ve Envanter Değerleme
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Veritabanı destekli gerçek zamanlı envanter, maliyet değerleme ve personel operasyon raporları
          </p>
        </div>

        <button
          type="button"
          onClick={exportActiveReportCsv}
          disabled={!data}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#f26522] hover:bg-[#d95619] rounded-xl shadow-sm disabled:opacity-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Aktif Raporu CSV İndir
        </button>
      </div>

      {/* Explicit Valuation Methodology Notice */}
      <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200/80 flex items-start gap-3">
        <Info className="w-5 h-5 text-[#f26522] shrink-0 mt-0.5" />
        <div className="text-xs text-stone-700 leading-relaxed">
          <strong className="text-stone-900 font-semibold block">
            Envanter Değerleme Metodolojisi (Standart Alış Maliyeti Yöntemi):
          </strong>
          {data?.valuationMethodology ||
            "Envanter Değeri = Σ (Mevcut Stok Miktarı × Kayıtlı Birim Alış Maliyeti). Bu değer yalnızca alış maliyeti üzerinden stok değerlemesini ifade eder; perakende satış fiyatı veya kâr tahmini değildir."}
        </div>
      </div>

      {/* Report Tabs & Date Filter */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  activeTab === t.id
                    ? "bg-[#f26522] text-white shadow-sm"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Date & Product Filter for Activity / Movement / Employee reports */}
        {(activeTab === "ACTIVITY" ||
          activeTab === "PRODUCT_HISTORY" ||
          activeTab === "EMPLOYEE") && (
          <div className="pt-3 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                Başlangıç Tarihi
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                Bitiş Tarihi
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-xl"
              />
            </div>
            {activeTab === "PRODUCT_HISTORY" && data && (
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  Ürün Seçimi
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-xl bg-white"
                >
                  <option value="">Tüm Ürünler</option>
                  {data.currentInventory.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              {(startDate || endDate || productId) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setProductId("");
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-[#f26522] hover:text-[#d95619]"
                >
                  Tarih Filtresini Temizle
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Report Body */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
        {loading || !data ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2 text-stone-500">
            <Loader2 className="w-6 h-6 animate-spin text-[#f26522]" />
            <span className="text-xs font-medium">Rapor hazırlanıyor...</span>
          </div>
        ) : activeTab === "CURRENT_INVENTORY" ||
          activeTab === "LOW_STOCK" ||
          activeTab === "OUT_OF_STOCK" ? (
          <div className="overflow-x-auto">
            {(() => {
              const list =
                activeTab === "CURRENT_INVENTORY"
                  ? data.currentInventory
                  : activeTab === "LOW_STOCK"
                  ? data.lowStockProducts
                  : data.outOfStockProducts;

              if (list.length === 0) {
                return (
                  <div className="p-10 text-center text-xs text-slate-500">
                    Bu raporda listelenecek ürün bulunmamaktadır.
                  </div>
                );
              }

              return (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                      <th className="py-3 px-4">SKU / Ürün Adı</th>
                      <th className="py-3 px-3">Kategori</th>
                      <th className="py-3 px-3">Tedarikçi</th>
                      <th className="py-3 px-3">Mevcut Stok</th>
                      <th className="py-3 px-3">Kritik Eşik</th>
                      <th className="py-3 px-3">Durum</th>
                      <th className="py-3 px-3">Birim Maliyet</th>
                      <th className="py-3 px-4 text-right">Envanter Değeri</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {list.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900 block">
                            {item.name}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {item.sku}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          {item.categoryName}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {item.supplierName}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {formatQuantity(item.quantity, item.unit)}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {formatQuantity(item.minStockLevel, item.unit)}
                        </td>
                        <td className="py-3 px-3">
                          <StockStatusBadge status={item.status} />
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          {formatCurrency(item.unitCost)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {formatCurrency(item.totalCostValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        ) : activeTab === "VALUATION" ? (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-500">
                  Toplam Envanter Alış Maliyeti Değeri
                </span>
                <p className="text-2xl font-bold text-blue-700 mt-1">
                  {formatCurrency(data.summary.totalInventoryValuation)}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-500">
                  Değerlemeye Dahil Ürün Çeşidi
                </span>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {data.summary.totalProducts}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-500">
                  Dönem İçi Mal Kabul (Giriş) Maliyeti
                </span>
                <p className="text-2xl font-bold text-emerald-700 mt-1">
                  {formatCurrency(data.summary.totalStockInCost)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                    <th className="py-3 px-4">Kategori Adı</th>
                    <th className="py-3 px-3">Ürün Çeşidi</th>
                    <th className="py-3 px-3">Toplam Birim Miktar</th>
                    <th className="py-3 px-4 text-right">
                      Toplam Alış Maliyeti Değerlemesi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {data.categoryValuation.map((c) => (
                    <tr key={c.categoryName} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {c.categoryName}
                      </td>
                      <td className="py-3 px-3">{c.productCount} Ürün</td>
                      <td className="py-3 px-3">
                        {formatQuantity(c.totalQuantity)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(c.totalValuation)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === "ACTIVITY" || activeTab === "PRODUCT_HISTORY" ? (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-500">Toplam Stok Girişi:</span>{" "}
                <strong className="text-emerald-700">
                  {data.summary.totalStockInCount} işlem (+
                  {formatQuantity(data.summary.totalStockInQty)})
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Toplam Stok Çıkışı:</span>{" "}
                <strong className="text-rose-700">
                  {data.summary.totalStockOutCount} işlem (-
                  {formatQuantity(data.summary.totalStockOutQty)})
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Sayım / Stok Düzeltme:</span>{" "}
                <strong className="text-indigo-700">
                  {data.summary.totalAdjustmentCount} işlem
                </strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                    <th className="py-3 px-4">Tarih / Kod</th>
                    <th className="py-3 px-3">Ürün</th>
                    <th className="py-3 px-3">Tür</th>
                    <th className="py-3 px-3">Miktar</th>
                    <th className="py-3 px-3">Önceki → Sonraki</th>
                    <th className="py-3 px-3">Neden / Referans</th>
                    <th className="py-3 px-4">Personel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {data.movements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-medium text-slate-900 block">
                          {formatDateTR(m.createdAt)}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {m.movementCode}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-900 block">
                          {m.product.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {m.product.sku}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <MovementTypeBadge
                          type={m.type}
                          isReversed={m.isReversed}
                        />
                      </td>
                      <td className="py-3 px-3 font-bold">
                        {formatQuantity(m.quantity, m.product.unit)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {m.stockBefore} → <strong>{m.stockAfter}</strong>
                      </td>
                      <td className="py-3 px-3">
                        {m.reason || "-"}{" "}
                        {m.referenceNo ? `(${m.referenceNo})` : ""}
                      </td>
                      <td className="py-3 px-4">{m.user.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* EMPLOYEE ACTIVITY TAB */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                  <th className="py-3.5 px-4">Personel Adı / E-Posta</th>
                  <th className="py-3.5 px-3">Rol</th>
                  <th className="py-3.5 px-3">Stok Girişleri</th>
                  <th className="py-3.5 px-3">Stok Çıkışları</th>
                  <th className="py-3.5 px-3">Düzeltme & İptal</th>
                  <th className="py-3.5 px-3">Toplam İşlem</th>
                  <th className="py-3.5 px-4 text-right">Son İşlem Tarihi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {data.employeeActivity.map((emp) => (
                  <tr key={emp.userId} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 block">
                        {emp.name}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {emp.email}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {emp.role === "ADMIN" ? "Yönetici" : "Personel"}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-emerald-700">
                      {emp.stockInCount} işlem
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-rose-700">
                      {emp.stockOutCount} işlem
                    </td>
                    <td className="py-3.5 px-3 text-indigo-700">
                      {emp.adjustmentCount} düzeltme / {emp.reversalCount} iptal
                    </td>
                    <td className="py-3.5 px-3 font-bold text-slate-900">
                      {emp.totalOperations}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-600">
                      {formatDateTR(emp.lastOperationAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
