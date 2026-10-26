"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Tags,
  Truck,
  BarChart3,
  Users,
  Settings,
  Search,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  User as UserIcon,
  AlertTriangle,
  XCircle,
  CheckCheck,
  Plus,
} from "lucide-react";
import { CavusLogo } from "@/components/brand/CavusLogo";
import { cn, formatDateTR, formatQuantity } from "@/lib/utils";
import {
  StockOperationModal,
  StockOperationType,
} from "@/components/stock/StockOperationModal";
import type { SessionUser } from "@/lib/auth";

interface NotificationItem {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  isRead: boolean;
  productId: string | null;
  createdAt: string;
}

interface SearchProductResult {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  imageUrl?: string | null;
  quantity: number;
  unit: string;
  stockStatus: string;
}

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchExpanded, setMobileSearchExpanded] = useState(false);

  // Mobile floating quick stock modal
  const [quickStockOpen, setQuickStockOpen] = useState(false);
  const [quickStockType, setQuickStockType] =
    useState<StockOperationType>("OUT");

  // Global search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchProductResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // User profile dropdown state
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // ignore network error
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications, pathname]);

  // Global search debounced lookup
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products?search=${encodeURIComponent(
            searchQuery.trim()
          )}&pageSize=6`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.items || []);
        }
      } catch {
        // ignore
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close popovers on outside click & Ctrl+K global search shortcut
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleMarkAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    fetchNotifications();
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/giris");
    router.refresh();
  };

  const navItems = [
    {
      label: "Genel Bakış",
      href: "/",
      icon: LayoutDashboard,
      visible: true,
    },
    {
      label: "Ürünler",
      href: "/urunler",
      icon: Package,
      visible: true,
    },
    {
      label: "Stok Hareketleri",
      href: "/stok-hareketleri",
      icon: ArrowLeftRight,
      visible: true,
    },
    {
      label: "Kategoriler",
      href: "/kategoriler",
      icon: Tags,
      visible: true,
    },
    {
      label: "Tedarikçiler",
      href: "/tedarikciler",
      icon: Truck,
      visible: true,
    },
    {
      label: "Raporlar",
      href: "/raporlar",
      icon: BarChart3,
      visible: user.role === "ADMIN" || user.permissions.canViewReports,
    },
    {
      label: "Kullanıcılar",
      href: "/kullanicilar",
      icon: Users,
      visible: user.role === "ADMIN",
    },
    {
      label: "Ayarlar",
      href: "/ayarlar",
      icon: Settings,
      visible: true,
    },
  ].filter((item) => item.visible);

  return (
    <div className="min-h-screen bg-[#f7f5f0] flex flex-col text-stone-900">
      {/* Top Horizontal Header Navigation */}
      <header className="sticky top-0 z-40 bg-white border-b border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="max-w-[1440px] mx-auto h-14 sm:h-16 px-3 sm:px-8 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Brand + Horizontal Nav Links */}
          <div className="flex items-center gap-4 lg:gap-8 h-full min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-1 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl"
                aria-label="Menüyü aç"
              >
                <Menu className="w-5 h-5" />
              </button>

              <Link
                href="/"
                className="flex items-center gap-2 focus:outline-none shrink-0"
              >
                <CavusLogo collapsed={false} variant="light" size="sm" />
              </Link>
            </div>

            {/* Desktop Horizontal Links */}
            <nav className="hidden lg:flex items-center gap-1 xl:gap-2 h-full">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative h-full inline-flex items-center px-3 text-[13.5px] font-medium transition-colors whitespace-nowrap",
                      isActive
                        ? "text-stone-950 font-semibold"
                        : "text-stone-600 hover:text-stone-900"
                    )}
                  >
                    {item.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t-full bg-[#f26522]" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Search Pill + Notifications + User Profile */}
          <div className="flex items-center gap-1.5 sm:gap-3 flex-1 lg:flex-initial justify-end">
            {/* Mobile Search Icon Button (< sm) */}
            <button
              type="button"
              onClick={() => {
                setMobileSearchExpanded((prev) => !prev);
                setTimeout(() => searchInputRef.current?.focus(), 60);
              }}
              className="sm:hidden p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-full"
              aria-label="Ürün Ara"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Desktop/Tablet Global Product Search (>= sm) */}
            <div
              ref={searchRef}
              className="hidden sm:block relative w-full max-w-[240px] md:max-w-[300px]"
            >
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onFocus={() => setSearchOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchQuery.trim()) {
                      setSearchOpen(false);
                      router.push(
                        `/urunler?search=${encodeURIComponent(
                          searchQuery.trim()
                        )}`
                      );
                    }
                  }}
                  placeholder="Ürün, SKU veya barkod ara... (Ctrl+K)"
                  className="w-full pl-9 pr-4 py-1.5 text-xs sm:text-[13px] bg-[#f5f3ef] border border-stone-200/90 rounded-full text-stone-800 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522] transition-all"
                />
              </div>

              {/* Search Dropdown */}
              {searchOpen && searchQuery.trim().length > 0 && (
                <div className="fixed left-3 right-3 top-16 sm:Info sm:absolute sm:right-0 sm:left-auto sm:top-auto sm:w-96 mt-2 bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden z-50">
                  {searchResults.length === 0 ? (
                    <div className="p-4 text-center text-xs text-stone-500">
                      &ldquo;{searchQuery}&rdquo; için eşleşen ürün bulunamadı.
                    </div>
                  ) : (
                    <div className="divide-y divide-stone-100 max-h-[65vh] overflow-y-auto">
                      {searchResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSearchOpen(false);
                            setMobileSearchExpanded(false);
                            setSearchQuery("");
                            router.push(`/urunler/${item.id}`);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-stone-50 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-7 rounded bg-stone-900 border border-stone-200 overflow-hidden shrink-0 flex items-center justify-center">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-3.5 h-3.5 text-stone-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-stone-900 truncate">
                                {item.name}
                              </p>
                              <p className="text-[11px] text-stone-500 font-mono">
                                SKU: {item.sku}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={cn(
                                "text-xs font-semibold px-2 py-0.5 rounded-full",
                                item.stockStatus === "OUT_OF_STOCK"
                                  ? "bg-rose-50 text-rose-700"
                                  : item.stockStatus === "LOW_STOCK"
                                  ? "bg-amber-50 text-amber-800"
                                  : "bg-emerald-50 text-emerald-700"
                              )}
                            >
                              {formatQuantity(item.quantity, item.unit)}
                            </span>
                          </div>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          setMobileSearchExpanded(false);
                          router.push(
                            `/urunler?search=${encodeURIComponent(
                              searchQuery.trim()
                            )}`
                          );
                        }}
                        className="w-full py-2.5 text-center text-xs font-semibold text-[#f26522] bg-stone-50 hover:bg-stone-100"
                      >
                        Tüm arama sonuçlarını Ürünler tablosunda gör →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notifications Bell */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                className="relative p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-full focus:outline-none"
                aria-label="Bildirimler"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#f26522] ring-2 ring-white" />
                )}
              </button>

              {notifOpen && (
                <div className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                        Stok ve Sistem Bildirimleri
                      </h3>
                      <p className="text-[11px] text-stone-500">
                        {unreadCount > 0
                          ? `${unreadCount} okunmamış uyarı mevcut`
                          : "Tüm bildirimler okundu"}
                      </p>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#f26522] hover:text-[#d95316]"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Okundu İşaretle
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-stone-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-stone-500">
                        Henüz bildirim bulunmuyor.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (n.productId) {
                              setNotifOpen(false);
                              router.push(`/urunler/${n.productId}`);
                            }
                          }}
                          className={cn(
                            "p-3.5 hover:bg-stone-50 transition-colors cursor-pointer flex items-start gap-3",
                            !n.isRead && "bg-orange-50/40"
                          )}
                        >
                          {n.severity === "CRITICAL" ? (
                            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-stone-900">
                              {n.title}
                            </p>
                            <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                              {n.message}
                            </p>
                            <p className="text-[10px] text-stone-400 mt-1">
                              {formatDateTR(n.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Current User Identity & Profile Menu */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2 pl-1 pr-1.5 py-1 rounded-full hover:bg-stone-100 transition-colors focus:outline-none"
              >
                <div className="w-8 h-8 rounded-full bg-stone-700 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-stone-900 leading-tight">
                    {user.name}
                  </p>
                  <p className="text-[11px] text-stone-500 leading-tight">
                    {user.role === "ADMIN" ? "Yönetici" : "Personel"}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 hidden sm:block" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-stone-200 shadow-xl py-1.5 z-50">
                  <div className="px-4 py-2.5 border-b border-stone-100">
                    <p className="text-xs font-semibold text-stone-900">
                      {user.name}
                    </p>
                    <p className="text-xs text-stone-500 truncate">
                      {user.email}
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-orange-50 text-[#f26522] border border-orange-200">
                      {user.role === "ADMIN"
                        ? "Tam Yetkili Yönetici"
                        : "Yetkili Depo Personeli"}
                    </span>
                  </div>

                  {user.role === "ADMIN" && (
                    <Link
                      href="/kullanicilar"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
                    >
                      <Users className="w-4 h-4 text-stone-400" />
                      Kullanıcı Yönetimi
                    </Link>
                  )}

                  <Link
                    href="/ayarlar"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
                  >
                    <UserIcon className="w-4 h-4 text-stone-400" />
                    Profil ve Sistem Ayarları
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="w-4 h-4" />
                    Güvenli Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Expandable Mobile Search Bar (< sm) */}
        {mobileSearchExpanded && (
          <div className="sm:hidden px-3 pb-3 pt-1 border-t border-stone-100 bg-white">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    setMobileSearchExpanded(false);
                    setSearchOpen(false);
                    router.push(
                      `/urunler?search=${encodeURIComponent(
                        searchQuery.trim()
                      )}`
                    );
                  }
                }}
                placeholder="Marka, fişek, SKU veya barkod ara..."
                className="w-full pl-9 pr-9 py-2 text-sm bg-[#f5f3ef] border border-stone-200 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522]"
              />
              <button
                type="button"
                onClick={() => {
                  setMobileSearchExpanded(false);
                  setSearchOpen(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {searchQuery.trim().length > 0 && (
              <div className="mt-2 bg-white rounded-2xl border border-stone-200 shadow-lg overflow-hidden max-h-72 overflow-y-auto divide-y divide-stone-100">
                {searchResults.length === 0 ? (
                  <div className="p-3.5 text-center text-xs text-stone-500">
                    Eşleşen ürün bulunamadı.
                  </div>
                ) : (
                  searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setMobileSearchExpanded(false);
                        setSearchOpen(false);
                        setSearchQuery("");
                        router.push(`/urunler/${item.id}`);
                      }}
                      className="w-full px-3.5 py-2.5 text-left hover:bg-stone-50 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-7 rounded bg-stone-900 border border-stone-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-3.5 h-3.5 text-stone-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-stone-900 truncate">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-stone-500 font-mono">
                            SKU: {item.sku}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-stone-800 shrink-0">
                        {formatQuantity(item.quantity, item.unit)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-stone-900/50 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[82vw] bg-white h-full shadow-2xl flex flex-col z-10">
            <div className="h-16 px-4 border-b border-stone-200 flex items-center justify-between">
              <CavusLogo collapsed={false} variant="light" size="sm" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      isActive
                        ? "bg-[#f26522] text-white font-semibold shadow-xs"
                        : "text-stone-700 hover:bg-stone-100"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-3 border-t border-stone-100 bg-stone-50/60">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Güvenli Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Body (pb-24 on mobile so bottom bar never overlaps content) */}
      <main className="flex-1 px-3.5 sm:px-8 pt-4 sm:pt-8 pb-24 lg:pb-8 max-w-[1440px] w-full mx-auto">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar (< lg) */}
      <nav
        aria-label="Mobil Alt Menü"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 items-center h-16 max-w-md mx-auto">
          <Link
            href="/"
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-colors",
              pathname === "/"
                ? "text-[#f26522] font-bold"
                : "text-stone-500 hover:text-stone-900 font-medium"
            )}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] leading-none">Genel Bakış</span>
          </Link>

          <Link
            href="/urunler"
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-colors",
              pathname.startsWith("/urunler")
                ? "text-[#f26522] font-bold"
                : "text-stone-500 hover:text-stone-900 font-medium"
            )}
          >
            <Package className="w-5 h-5" />
            <span className="text-[10px] leading-none">Ürünler</span>
          </Link>

          {/* Center Prominent Quick Stock Operation Button */}
          <div className="flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={() => {
                setQuickStockType(
                  user.permissions.canStockOut ? "OUT" : "IN"
                );
                setQuickStockOpen(true);
              }}
              className="w-12 h-12 -mt-5 rounded-2xl bg-[#f26522] hover:bg-[#d95619] text-white shadow-lg shadow-orange-500/30 flex items-center justify-center ring-4 ring-[#f7f5f0] active:scale-95 transition-all"
              aria-label="Hızlı Stok İşlemi"
            >
              <Plus className="w-6 h-6" />
            </button>
            <span className="text-[10px] font-bold text-stone-700 mt-1 leading-none">
              Stok İşlemi
            </span>
          </div>

          <Link
            href="/stok-hareketleri"
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-colors",
              pathname.startsWith("/stok-hareketleri")
                ? "text-[#f26522] font-bold"
                : "text-stone-500 hover:text-stone-900 font-medium"
            )}
          >
            <ArrowLeftRight className="w-5 h-5" />
            <span className="text-[10px] leading-none">Hareketler</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-colors",
              mobileMenuOpen
                ? "text-[#f26522] font-bold"
                : "text-stone-500 hover:text-stone-900 font-medium"
            )}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] leading-none">Menü</span>
          </button>
        </div>
      </nav>

      {/* Global Quick Stock Modal triggered from Mobile Bottom Bar */}
      <StockOperationModal
        open={quickStockOpen}
        onClose={() => setQuickStockOpen(false)}
        operationType={quickStockType}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
