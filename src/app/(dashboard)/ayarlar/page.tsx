"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Save,
  ShieldCheck,
  Loader2,
  FileText,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { formatDateTR } from "@/lib/utils";

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Settings fields
  const [companyName, setCompanyName] = useState("");
  const [currency, setCurrency] = useState("TRY");
  const [currencySymbol, setCurrencySymbol] = useState("₺");
  const [timezone, setTimezone] = useState("Europe/Istanbul");
  const [lowStockAlertEnabled, setLowStockAlertEnabled] = useState(true);
  const [customUnits, setCustomUnits] = useState(
    "Adet,Kutu,Paket,Kg,Gram,Litre,Metre,Koli,Palet"
  );
  const [defaultLocation, setDefaultLocation] = useState("ANA-DEPO");

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, setRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/settings"),
      ]);
      const meData = await meRes.json();
      const setData = await setRes.json();

      if (meData.user) {
        setIsAdmin(meData.user.role === "ADMIN");
      }
      if (setData.settings) {
        const s = setData.settings;
        setCompanyName(s.companyName);
        setCurrency(s.currency);
        setCurrencySymbol(s.currencySymbol);
        setTimezone(s.timezone);
        setLowStockAlertEnabled(s.lowStockAlertEnabled);
        setCustomUnits(s.customUnits);
        setDefaultLocation(s.defaultLocation);
      }
      if (setData.auditLogs) {
        setAuditLogs(setData.auditLogs);
      }
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          currency,
          currencySymbol,
          timezone,
          lowStockAlertEnabled,
          customUnits,
          defaultLocation,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          type: "error",
          title: "Kaydedilemedi",
          message: data.error || "Ayarlar güncellenemedi.",
        });
        return;
      }

      toast({
        type: "success",
        title: "Ayarlar Güncellendi",
        message: "Sistem yapılandırması ve ölçü birimleri başarıyla kaydedildi.",
      });
      loadSettings();
    } catch {
      toast({
        type: "error",
        title: "Hata",
        message: "Sunucu bağlantı hatası.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-2 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="text-xs font-medium">Ayarlar yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-600" />
          Sistem Ayarları ve Denetim Günlüğü
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Para birimi (varsayılan TRY ₺), ölçü birimleri, depo lokasyon kodu ve sistem güvenlik denetim kayıtları
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Form */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            İşletme ve Envanter Yapılandırması
          </h2>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                İşletme / Depo Adı
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Varsayılan Para Birimi
                </label>
                <select
                  disabled={!isAdmin}
                  value={currency}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCurrency(val);
                    if (val === "TRY") setCurrencySymbol("₺");
                    if (val === "USD") setCurrencySymbol("$");
                    if (val === "EUR") setCurrencySymbol("€");
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-50"
                >
                  <option value="TRY">TRY — Türk Lirası (₺)</option>
                  <option value="USD">USD — ABD Doları ($)</option>
                  <option value="EUR">EUR — Euro (€)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Para Birimi Sembolü
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  required
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Yerel Saat Dilimi
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  required
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Varsayılan Depo Lokasyon Kodu
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  required
                  value={defaultLocation}
                  onChange={(e) => setDefaultLocation(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg disabled:bg-slate-50"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={lowStockAlertEnabled}
                    onChange={(e) => setLowStockAlertEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  Otomatik Kritik Stok Bildirimlerini Etkinleştir
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Desteklenen Ölçü Birimleri (Virgül ile ayırarak yeni birim ekleyebilirsiniz)
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                required
                value={customUnits}
                onChange={(e) => setCustomUnits(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Standart birimler: Adet, Kutu, Paket, Kg, Gram, Litre, Metre, Koli, Palet
              </p>
            </div>

            {isAdmin ? (
              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Ayarları Kaydet
                </button>
              </div>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                Sistem ayarlarını yalnızca Sistem Yöneticisi değiştirebilir.
              </p>
            )}
          </form>
        </div>

        {/* Security & Barcode Readiness Info */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Mimari ve Barkod Uyumluluğu
            </h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong>Barkod Okuyucu Uyumluluğu:</strong> Ürün kartlarında isteğe bağlı benzersiz barkod alanı mevcuttur. Üst arama çubuğu ve Stok Giriş/Çıkış pencereleri klavye emülasyonlu (HID) barkod okuyucularla doğrudan çalışacak şekilde tasarlanmıştır.
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong>Veri Bütünlüğü:</strong> Stok bakiyeleri asla negatif olamaz ve her hareket ilişkisel veritabanı işlemi (transaction) içinde atomik olarak güncellenir.
          </p>
        </div>
      </div>

      {/* Audit Log Section (Admin Only) */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Sistem Denetim Günlüğü (Audit Log)
            </h2>
            <p className="text-xs text-slate-500">
              Ürün değişiklikleri, stok hareketleri, yetki güncellemeleri ve oturum açma olaylarının değiştirilemez kaydı
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                  <th className="py-3 px-4">Tarih ve Saat</th>
                  <th className="py-3 px-3">İşlem Kodu</th>
                  <th className="py-3 px-3">Varlık</th>
                  <th className="py-3 px-3">Açıklama / Özet</th>
                  <th className="py-3 px-4">Kullanıcı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      {formatDateTR(log.createdAt)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {log.entityType}
                    </td>
                    <td className="py-3 px-3 text-slate-900 font-medium">
                      {log.summary}
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {log.user?.name || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
