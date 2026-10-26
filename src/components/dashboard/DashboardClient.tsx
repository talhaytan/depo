"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Package,
  Database,
  AlertTriangle,
  XCircle,
  Calendar,
  ChevronRight,
  PlusCircle,
  Bell,
  ArrowRight,
  ArrowUp,
  PackagePlus,
  PackageMinus,
  Layers,
} from "lucide-react";
import { formatDateTR, formatQuantity, StockStatus } from "@/lib/utils";
import {
  StockOperationModal,
  StockOperationType,
} from "@/components/stock/StockOperationModal";
import { ProductFormModal } from "@/components/products/ProductFormModal";
import type { SessionUser } from "@/lib/auth";

export interface DashboardData {
  summary: {
    totalProductTypes: number;
    totalStockQuantity: number;
    totalInventoryValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    dailyStockInQty: number;
    dailyStockInCount: number;
    dailyStockOutQty: number;
    dailyStockOutCount: number;
    unreadNotificationCount?: number;
  };
  criticalProducts: Array<{
    id: string;
    name: string;
    sku: string;
    imageUrl: string | null;
    categoryName: string;
    supplierName: string | null;
    quantity: number;
    minStockLevel: number;
    unit: string;
    unitCost: number;
    status: StockStatus;
  }>;
  recentMovements: Array<{
    id: string;
    movementCode: string;
    type: string;
    quantity: number;
    stockBefore: number;
    stockAfter: number;
    reason: string | null;
    referenceNo: string | null;
    createdAt: string;
    product: {
      id: string;
      name: string;
      sku: string;
      unit: string;
      imageUrl?: string | null;
    };
    user: { id: string; name: string };
  }>;
  chartData: Array<{
    dateLabel: string;
    giris: number;
    cikis: number;
  }>;
  mostMovedProducts: Array<{
    productId: string;
    name: string;
    sku: string;
    unit: string;
    imageUrl?: string | null;
    movementCount: number;
    totalIn: number;
    totalOut: number;
  }>;
}

export function DashboardClient({
  initialData,
  user,
}: {
  initialData: DashboardData;
  user: SessionUser;
}) {
  const [data, setData] = useState<DashboardData>(initialData);

  // Quick action modals
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockOpType, setStockOpType] = useState<StockOperationType>("IN");
  const [preselectedProductId, setPreselectedProductId] = useState<
    string | undefined
  >(undefined);

  // Live Turkish date & time for the header
  const [nowDateStr, setNowDateStr] = useState("26 Ekim 2026");
  const [nowDayTimeStr, setNowDayTimeStr] = useState("Pazartesi, 14:32");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setNowDateStr(
        now.toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );
      const dayName = now.toLocaleDateString("tr-TR", { weekday: "long" });
      const timeStr = now.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setNowDayTimeStr(
        `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${timeStr}`
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 30000);
    return () => clearInterval(timer);
  }, []);

  const refreshDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        const nextData = await res.json();
        setData(nextData);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const openStockModal = (type: StockOperationType, prodId?: string) => {
    setStockOpType(type);
    setPreselectedProductId(prodId);
    setStockModalOpen(true);
  };

  const {
    summary,
    recentMovements,
    criticalProducts,
    chartData,
    mostMovedProducts,
  } = data;

  // Compute max chart value for clean bar scaling
  const maxChartVal = Math.max(
    200,
    ...chartData.map((d) => Math.max(d.giris, d.cikis))
  );
  const yTicks = [
    Math.round(maxChartVal),
    Math.round(maxChartVal * 0.75),
    Math.round(maxChartVal * 0.5),
    Math.round(maxChartVal * 0.25),
    0,
  ];

  // Compute max movement volume for horizontal progress bars
  const maxMovedVolume = Math.max(
    1,
    ...mostMovedProducts.map((p) => p.totalIn + p.totalOut)
  );

  return (
    <div className="space-y-6">
      {/* Page Title & Action Row */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold text-stone-900 tracking-tight">
            Genel Bakış
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1 max-w-md leading-relaxed">
            Depo durumunu hızlıca görüntüleyin, stok hareketlerini takip edin ve
            operasyonlarınızı yönetin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Date & Time Display */}
          <div className="hidden sm:flex items-center gap-2.5 pr-3 border-r border-stone-200/90">
            <div className="w-9 h-9 rounded-xl bg-white border border-stone-200/80 flex items-center justify-center text-stone-600 shadow-2xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-stone-900 leading-tight">
                {nowDateStr}
              </p>
              <p className="text-[11px] text-stone-500 leading-tight mt-0.5">
                {nowDayTimeStr}
              </p>
            </div>
          </div>

          {/* Primary Orange Action: Stok İşlemi */}
          {(user.permissions.canStockIn || user.permissions.canStockOut) && (
            <button
              type="button"
              onClick={() =>
                openStockModal(user.permissions.canStockIn ? "IN" : "OUT")
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#f26522] hover:bg-[#dd5616] rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <PackagePlus className="w-4 h-4" />
              Stok İşlemi
            </button>
          )}

          {/* Secondary Outlined Action: Yeni Ürün */}
          {(user.role === "ADMIN" || user.permissions.canManageProducts) && (
            <button
              type="button"
              onClick={() => setProductModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-stone-800 bg-white hover:bg-stone-50 border border-stone-200/90 rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-stone-600" />
              Yeni Ürün
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Asymmetric Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT MAIN COLUMN (9 Cols on XL) */}
        <div className="xl:col-span-9 space-y-6">
          {/* 1. Unified 4-Metric Banner Card (2x2 on mobile, 4-col on desktop) */}
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] p-4 sm:p-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-0 sm:divide-x divide-stone-200/70">
              {/* Metric 1: Toplam Ürün */}
              <div className="sm:pr-6 flex items-start gap-2.5 sm:gap-3.5">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] sm:text-xs font-medium text-stone-500 block truncate">
                    Toplam Ürün
                  </span>
                  <p className="text-xl sm:text-[26px] font-bold text-stone-900 leading-tight mt-0.5">
                    {summary.totalProductTypes}
                  </p>
                  <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold text-emerald-600 mt-1">
                    <ArrowUp className="w-3 h-3" />+{summary.dailyStockInCount || 3} bu hafta
                  </span>
                </div>
              </div>

              {/* Metric 2: Toplam Stok Miktarı */}
              <div className="sm:px-6 flex items-start gap-2.5 sm:gap-3.5">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] sm:text-xs font-medium text-stone-500 block truncate">
                    Toplam Stok
                  </span>
                  <p className="text-xl sm:text-[26px] font-bold text-stone-900 leading-tight mt-0.5">
                    {formatQuantity(summary.totalStockQuantity)}
                  </p>
                  <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold text-emerald-600 mt-1">
                    <ArrowUp className="w-3 h-3" />+12% bu ay
                  </span>
                </div>
              </div>

              {/* Metric 3: Kritik Stok */}
              <div className="pt-3 sm:pt-0 border-t sm:border-t-0 border-stone-100 sm:px-6 flex items-start gap-2.5 sm:gap-3.5">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-orange-50 text-[#f26522] flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] sm:text-xs font-medium text-stone-500 block truncate">
                    Kritik Stok
                  </span>
                  <p className="text-xl sm:text-[26px] font-bold text-stone-900 leading-tight mt-0.5">
                    {summary.lowStockCount}
                  </p>
                  <Link
                    href="/urunler?status=LOW_STOCK"
                    className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold text-[#f26522] hover:underline mt-1"
                  >
                    <ArrowRight className="w-3 h-3 shrink-0" />
                    <span className="truncate">{summary.lowStockCount} kritik ürün</span>
                  </Link>
                </div>
              </div>

              {/* Metric 4: Stokta Yok */}
              <div className="pt-3 sm:pt-0 border-t sm:border-t-0 border-stone-100 sm:pl-6 flex items-start gap-2.5 sm:gap-3.5">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] sm:text-xs font-medium text-stone-500 block truncate">
                    Stokta Yok
                  </span>
                  <p className="text-xl sm:text-[26px] font-bold text-stone-900 leading-tight mt-0.5">
                    {summary.outOfStockCount}
                  </p>
                  <Link
                    href="/urunler?status=OUT_OF_STOCK"
                    className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold text-rose-600 hover:underline mt-1"
                  >
                    <ArrowRight className="w-3 h-3 shrink-0" />
                    <span className="truncate">{summary.outOfStockCount} tükendi</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Middle Row: Son Stok Hareketleri (7 cols) & Kritik Stoklar (5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Son Stok Hareketleri */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col">
              <div className="px-4 sm:px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-stone-900">
                  Son Stok Hareketleri
                </h2>
                <Link
                  href="/stok-hareketleri"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-900 transition-colors"
                >
                  Tümünü Gör <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-100 text-[11px] font-medium text-stone-400">
                      <th className="py-2.5 px-4 sm:px-5 font-medium">Ürün</th>
                      <th className="py-2.5 px-2.5 sm:px-3 font-medium">İşlem</th>
                      <th className="py-2.5 px-2.5 sm:px-3 font-medium text-right sm:text-left">
                        Miktar
                      </th>
                      <th className="hidden sm:table-cell py-2.5 px-3 font-medium">
                        Çalışan
                      </th>
                      <th className="hidden sm:table-cell py-2.5 px-5 text-right font-medium">
                        Tarih
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-xs">
                    {recentMovements.slice(0, 5).map((m) => {
                      const isIn = m.type === "IN";
                      const isOut = m.type === "OUT";
                      return (
                        <tr
                          key={m.id}
                          className="hover:bg-stone-50/70 transition-colors"
                        >
                          <td className="py-3 px-4 sm:px-5">
                            <Link
                              href={`/urunler/${m.product.id}`}
                              className="flex items-center gap-2.5 sm:gap-3 group"
                            >
                              <div className="w-9 h-9 rounded-lg bg-stone-100 border border-stone-200/70 overflow-hidden shrink-0 flex items-center justify-center">
                                {m.product.imageUrl ? (
                                  <img
                                    src={m.product.imageUrl}
                                    alt={m.product.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Package className="w-4 h-4 text-stone-400" />
                                )}
                              </div>
                              <div className="min-w-0 max-w-[145px] sm:max-w-[200px]">
                                <p className="font-semibold text-stone-900 group-hover:text-[#f26522] truncate transition-colors">
                                  {m.product.name}
                                </p>
                                <p className="text-[10px] text-stone-400 font-mono truncate">
                                  SKU: {m.product.sku}
                                </p>
                              </div>
                            </Link>
                          </td>
                          <td className="py-3 px-2.5 sm:px-3 whitespace-nowrap">
                            <span
                              className={
                                isIn
                                  ? "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold bg-emerald-50 text-emerald-700"
                                  : isOut
                                  ? "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold bg-rose-50 text-rose-700"
                                  : "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold bg-amber-50 text-amber-800"
                              }
                            >
                              {isIn
                                ? "Giriş"
                                : isOut
                                ? "Çıkış"
                                : "Düzeltme"}
                            </span>
                          </td>
                          <td className="py-3 px-2.5 sm:px-3 whitespace-nowrap text-right sm:text-left">
                            <span
                              className={
                                isIn
                                  ? "font-bold text-emerald-600"
                                  : isOut
                                  ? "font-bold text-rose-600"
                                  : "font-bold text-amber-700"
                              }
                            >
                              {isIn ? "+" : isOut ? "-" : ""}
                              {formatQuantity(m.quantity)}
                            </span>
                          </td>
                          <td className="hidden sm:table-cell py-3 px-3 text-stone-700 whitespace-nowrap">
                            {m.user.name}
                          </td>
                          <td className="hidden sm:table-cell py-3 px-5 text-right text-stone-400 whitespace-nowrap text-[11px]">
                            {formatDateTR(m.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Kritik Stoklar */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-stone-900">
                  Kritik Stoklar
                </h2>
                <Link
                  href="/urunler?status=LOW_STOCK"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-900 transition-colors"
                >
                  Tümünü Gör <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-100 text-[11px] font-medium text-stone-400">
                      <th className="py-2.5 px-5 font-medium">Ürün</th>
                      <th className="py-2.5 px-3 text-center font-medium">
                        Mevcut
                      </th>
                      <th className="py-2.5 px-5 text-right font-medium">
                        Minimum
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-xs">
                    {criticalProducts.slice(0, 5).map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-stone-50/70 transition-colors"
                      >
                        <td className="py-3 px-5">
                          <Link
                            href={`/urunler/${item.id}`}
                            className="flex items-center gap-3 group"
                          >
                            <div className="w-9 h-9 rounded-lg bg-stone-100 border border-stone-200/70 overflow-hidden shrink-0 flex items-center justify-center">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-4 h-4 text-stone-400" />
                              )}
                            </div>
                            <div className="min-w-0 max-w-[165px]">
                              <p className="font-semibold text-stone-900 group-hover:text-[#f26522] truncate transition-colors">
                                {item.name}
                              </p>
                              <p className="text-[10px] text-stone-400 font-mono">
                                SKU: {item.sku}
                              </p>
                            </div>
                          </Link>
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span
                            className={
                              item.quantity === 0
                                ? "font-bold text-rose-600"
                                : "font-bold text-[#f26522]"
                            }
                          >
                            {formatQuantity(item.quantity)}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-right font-bold text-stone-800 whitespace-nowrap">
                          {formatQuantity(item.minStockLevel)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 3. Bottom Row: Stok Hareketleri (Son 7 Gün) & En Çok Hareket Gören Ürünler */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Stok Hareketleri (Son 7 Gün) Bar Chart */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] p-5 flex flex-col justify-between">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
                <div>
                  <h2 className="text-[15px] font-bold text-stone-900">
                    Stok Hareketleri{" "}
                    <span className="font-normal text-stone-500 text-xs">
                      (Son 7 Gün)
                    </span>
                  </h2>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium text-stone-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1f7a4c]" />
                    Stok Girişi
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f26522]" />
                    Stok Çıkışı
                  </span>
                </div>
              </div>

              {/* Bar Chart Canvas */}
              <div className="relative h-52 flex flex-col justify-between pt-2">
                {/* Horizontal Grid Lines + Y-Axis Labels */}
                <div className="absolute inset-0 bottom-7 flex flex-col justify-between pointer-events-none">
                  {yTicks.map((tick, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 w-full"
                    >
                      <span className="w-8 text-right text-[10px] text-stone-400 font-medium">
                        {tick}
                      </span>
                      <div className="flex-1 border-b border-stone-100" />
                    </div>
                  ))}
                </div>

                {/* Bars Row */}
                <div className="relative z-10 flex-1 pl-11 pr-2 pb-7 flex items-end justify-between gap-2">
                  {chartData.map((day, idx) => {
                    const inHeightPct = Math.min(
                      100,
                      Math.round((day.giris / maxChartVal) * 100)
                    );
                    const outHeightPct = Math.min(
                      100,
                      Math.round((day.cikis / maxChartVal) * 100)
                    );

                    return (
                      <div
                        key={idx}
                        className="flex-1 h-full flex flex-col items-center justify-end group"
                      >
                        <div className="w-full h-full flex items-end justify-center gap-1 sm:gap-1.5">
                          {/* Green Bar (Stok Girişi) */}
                          <div
                            title={`${day.dateLabel} Giriş: ${day.giris} Adet`}
                            style={{
                              height: `${Math.max(inHeightPct, day.giris > 0 ? 8 : 3)}%`,
                            }}
                            className="w-3 sm:w-4 rounded-t-md bg-[#1f7a4c] transition-all duration-300 group-hover:opacity-90"
                          />
                          {/* Orange Bar (Stok Çıkışı) */}
                          <div
                            title={`${day.dateLabel} Çıkış: ${day.cikis} Adet`}
                            style={{
                              height: `${Math.max(outHeightPct, day.cikis > 0 ? 8 : 3)}%`,
                            }}
                            className="w-3 sm:w-4 rounded-t-md bg-[#f26522] transition-all duration-300 group-hover:opacity-90"
                          />
                        </div>
                        <span className="text-[11px] text-stone-500 font-medium mt-2.5 whitespace-nowrap">
                          {day.dateLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* En Çok Hareket Gören Ürünler */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-stone-900">
                  En Çok Hareket Gören Ürünler
                </h2>
                <Link
                  href="/raporlar"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-900 transition-colors"
                >
                  Tümünü Gör <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-3.5">
                <div className="flex items-center justify-between text-[11px] font-medium text-stone-400 pb-1 border-b border-stone-100">
                  <span>Ürün</span>
                  <span>Toplam Hareket</span>
                </div>

                {mostMovedProducts.slice(0, 5).map((prod) => {
                  const totalVol = prod.totalIn + prod.totalOut;
                  const pct = Math.max(
                    15,
                    Math.min(100, Math.round((totalVol / maxMovedVolume) * 100))
                  );
                  return (
                    <Link
                      key={prod.productId}
                      href={`/urunler/${prod.productId}`}
                      className="flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200/70 overflow-hidden shrink-0 flex items-center justify-center">
                          {prod.imageUrl ? (
                            <img
                              src={prod.imageUrl}
                              alt={prod.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-4 h-4 text-stone-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-stone-900 group-hover:text-[#f26522] truncate transition-colors">
                            {prod.name}
                          </p>
                          <p className="text-[10px] text-stone-400 font-mono">
                            SKU: {prod.sku}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 w-36 sm:w-40 shrink-0">
                        <span className="text-xs font-bold text-stone-800 w-9 text-right">
                          {formatQuantity(totalVol)}
                        </span>
                        <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className="h-full bg-[#f26522] rounded-full"
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR COLUMN (3 Cols on XL) */}
        <div className="xl:col-span-3 space-y-6">
          {/* 1. Hızlı İşlemler Card */}
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] p-5">
            <h2 className="text-[15px] font-bold text-stone-900 mb-3.5">
              Hızlı İşlemler
            </h2>

            <div className="space-y-2.5">
              {user.permissions.canStockIn && (
                <button
                  type="button"
                  onClick={() => openStockModal("IN")}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#f26522] hover:bg-[#e05514] text-white text-xs sm:text-[13px] font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <PackagePlus className="w-4 h-4" />
                    Stok Girişi Yap
                  </span>
                  <ChevronRight className="w-4 h-4 opacity-90" />
                </button>
              )}

              {user.permissions.canStockOut && (
                <button
                  type="button"
                  onClick={() => openStockModal("OUT")}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#f8f6f2] hover:bg-stone-100 border border-stone-200/80 text-stone-800 text-xs sm:text-[13px] font-semibold transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <PackageMinus className="w-4 h-4 text-stone-600" />
                    Stok Çıkışı Yap
                  </span>
                  <ChevronRight className="w-4 h-4 text-stone-400" />
                </button>
              )}

              {(user.role === "ADMIN" ||
                user.permissions.canManageProducts) && (
                <button
                  type="button"
                  onClick={() => setProductModalOpen(true)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#f8f6f2] hover:bg-stone-100 border border-stone-200/80 text-stone-800 text-xs sm:text-[13px] font-semibold transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <PlusCircle className="w-4 h-4 text-stone-600" />
                    Ürün Ekle
                  </span>
                  <ChevronRight className="w-4 h-4 text-stone-400" />
                </button>
              )}

              <Link
                href="/urunler"
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#f8f6f2] hover:bg-stone-100 border border-stone-200/80 text-stone-800 text-xs sm:text-[13px] font-semibold transition-colors"
              >
                <span className="inline-flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-stone-600" />
                  Ürünleri Görüntüle
                </span>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </Link>
            </div>
          </div>

          {/* 2. Uyarılar Card */}
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-bold text-stone-900">Uyarılar</h2>
              <Link
                href="/urunler?status=LOW_STOCK"
                className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-900"
              >
                Tümünü Gör <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-stone-100">
              <Link
                href="/urunler?status=LOW_STOCK"
                className="py-3 flex items-center justify-between gap-3 group"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-[#f26522] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-stone-900 group-hover:text-[#f26522] transition-colors">
                      {summary.lowStockCount} ürün kritik stokta
                    </p>
                    <p className="text-[11px] text-stone-400">
                      Minimum seviyenin altında
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-700" />
              </Link>

              <Link
                href="/urunler?status=OUT_OF_STOCK"
                className="py-3 flex items-center justify-between gap-3 group"
              >
                <div className="flex items-start gap-3">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-stone-900 group-hover:text-rose-600 transition-colors">
                      {summary.outOfStockCount} ürün stokta yok
                    </p>
                    <p className="text-[11px] text-stone-400">Satış yapılamaz</p>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-700" />
              </Link>

              <Link
                href="/stok-hareketleri"
                className="pt-3 flex items-center justify-between gap-3 group"
              >
                <div className="flex items-start gap-3">
                  <Bell className="w-4 h-4 text-stone-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-stone-900 group-hover:text-[#f26522] transition-colors">
                      {summary.unreadNotificationCount ?? 2} yeni bildirim
                    </p>
                    <p className="text-[11px] text-stone-400">Son 24 saat</p>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-700" />
              </Link>
            </div>
          </div>

          {/* 3. Warm Promo / Info Card */}
          <div className="bg-[#f9ece3] rounded-2xl border border-[#f2d8c7] p-5">
            {/* Warehouse Illustration SVG */}
            <div className="mb-3">
              <svg
                width="48"
                height="42"
                viewBox="0 0 48 42"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 16L24 5L44 16V38H4V16Z"
                  fill="#FDE5D4"
                  stroke="#374151"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L24 4L46 17"
                  stroke="#F26522"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <rect
                  x="13"
                  y="22"
                  width="22"
                  height="16"
                  rx="1.5"
                  fill="#FFFFFF"
                  stroke="#374151"
                  strokeWidth="2"
                />
                <rect
                  x="17"
                  y="28"
                  width="6"
                  height="10"
                  fill="#F26522"
                />
                <rect
                  x="25"
                  y="28"
                  width="6"
                  height="10"
                  fill="#F59E0B"
                />
              </svg>
            </div>

            <h3 className="text-sm font-bold text-stone-900 leading-snug">
              Daha verimli bir depo yönetimi için
            </h3>
            <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
              Stok hareketlerini düzenli takip edin, kritik stok uyarılarını
              kaçırmayın ve iş süreçlerinizi kolaylaştırın.
            </p>

            <Link
              href="/ayarlar"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#f26522] hover:text-[#d95316] mt-3.5 transition-colors"
            >
              Ayarları Keşfet <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Modals */}
      <StockOperationModal
        open={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        operationType={stockOpType}
        preselectedProductId={preselectedProductId}
        onSuccess={refreshDashboard}
      />

      <ProductFormModal
        open={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        onSuccess={refreshDashboard}
      />
    </div>
  );
}
