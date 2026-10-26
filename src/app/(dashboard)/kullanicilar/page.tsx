"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  ShieldCheck,
  Edit2,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatDateTR } from "@/lib/utils";

interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
  isActive: boolean;
  canManageProducts: boolean;
  canManageCategories: boolean;
  canManageSuppliers: boolean;
  canStockIn: boolean;
  canStockOut: boolean;
  canAdjustStock: boolean;
  canViewReports: boolean;
  canExportData: boolean;
  createdAt: string;
  _count?: {
    movements: number;
  };
}

export default function UsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "EMPLOYEE">("EMPLOYEE");
  const [isActive, setIsActive] = useState(true);

  // Permissions
  const [canManageProducts, setCanManageProducts] = useState(false);
  const [canManageCategories, setCanManageCategories] = useState(false);
  const [canManageSuppliers, setCanManageSuppliers] = useState(false);
  const [canStockIn, setCanStockIn] = useState(true);
  const [canStockOut, setCanStockOut] = useState(true);
  const [canAdjustStock, setCanAdjustStock] = useState(false);
  const [canViewReports, setCanViewReports] = useState(false);
  const [canExportData, setCanExportData] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      if (!meData.user || meData.user.role !== "ADMIN") {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("EMPLOYEE");
    setIsActive(true);
    setCanManageProducts(false);
    setCanManageCategories(false);
    setCanManageSuppliers(false);
    setCanStockIn(true);
    setCanStockOut(true);
    setCanAdjustStock(false);
    setCanViewReports(false);
    setCanExportData(false);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const openEdit = (u: UserAccount) => {
    setEditing(u);
    setName(u.name);
    setEmail(u.email);
    setPassword("");
    setRole(u.role);
    setIsActive(u.isActive);
    setCanManageProducts(u.canManageProducts);
    setCanManageCategories(u.canManageCategories);
    setCanManageSuppliers(u.canManageSuppliers);
    setCanStockIn(u.canStockIn);
    setCanStockOut(u.canStockOut);
    setCanAdjustStock(u.canAdjustStock);
    setCanViewReports(u.canViewReports);
    setCanExportData(u.canExportData);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const url = editing ? `/api/users/${editing.id}` : "/api/users";
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password: password || undefined,
          role,
          isActive,
          canManageProducts: role === "ADMIN" || canManageProducts,
          canManageCategories: role === "ADMIN" || canManageCategories,
          canManageSuppliers: role === "ADMIN" || canManageSuppliers,
          canStockIn: role === "ADMIN" || canStockIn,
          canStockOut: role === "ADMIN" || canStockOut,
          canAdjustStock: role === "ADMIN" || canAdjustStock,
          canViewReports: role === "ADMIN" || canViewReports,
          canExportData: role === "ADMIN" || canExportData,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Kullanıcı kaydedilemedi.");
        return;
      }

      toast({
        type: "success",
        title: editing ? "Kullanıcı Güncellendi" : "Yeni Personel Eklendi",
        message: `${name} (${email}) yetkileri kaydedildi.`,
      });

      setModalOpen(false);
      loadUsers();
    } catch {
      setErrorMsg("Sunucu hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white p-12 rounded-xl border border-slate-200 text-center">
        <h2 className="text-lg font-bold text-slate-900">
          Bu Sayfa Yalnızca Sistem Yöneticilerine Özeldir
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Personel hesapları ve yetkilendirme ayarları yalnızca Yönetici rolü ile görüntülenebilir.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Kullanıcılar ve Yetki Yönetimi
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Her depo personeli için bireysel hesap açın, görev bazlı modül yetkileri tanımlayın veya hesapları pasife alın
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Yeni Personel Hesabı Oluştur
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs font-medium">
              Kullanıcılar yükleniyor...
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                  <th className="py-3.5 px-4">Ad Soyad / E-Posta</th>
                  <th className="py-3.5 px-3">Rol</th>
                  <th className="py-3.5 px-3">Durum</th>
                  <th className="py-3.5 px-3">Tanımlı Yetkiler</th>
                  <th className="py-3.5 px-3">İşlem Sayısı</th>
                  <th className="py-3.5 px-3">Kayıt Tarihi</th>
                  <th className="py-3.5 px-4 text-right">Düzenle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 block">
                        {u.name}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {u.email}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          u.role === "ADMIN"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {u.role === "ADMIN" ? "Yönetici" : "Personel"}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-4 h-4" /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                          <XCircle className="w-4 h-4" /> Pasif
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      {u.role === "ADMIN" ? (
                        <span className="text-xs font-medium text-blue-700">
                          Tüm Sistem Modülleri (Tam Yetki)
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.canStockIn && (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                              Stok Giriş
                            </span>
                          )}
                          {u.canStockOut && (
                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-medium">
                              Stok Çıkış
                            </span>
                          )}
                          {u.canAdjustStock && (
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-medium">
                              Sayım/Düzeltme
                            </span>
                          )}
                          {u.canManageProducts && (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-medium">
                              Ürün Yönetimi
                            </span>
                          )}
                          {u.canManageCategories && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium">
                              Kategori
                            </span>
                          )}
                          {u.canManageSuppliers && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium">
                              Tedarikçi
                            </span>
                          )}
                          {u.canViewReports && (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-medium">
                              Raporlar
                            </span>
                          )}
                          {u.canExportData && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium">
                              CSV İndir
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-800">
                      {u._count?.movements ?? 0} hareket
                    </td>
                    <td className="py-3.5 px-3 text-slate-600">
                      {formatDateTR(u.createdAt, false)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Yetki & Düzenle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit User Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editing
            ? `Kullanıcı ve Yetki Düzenle: ${editing.name}`
            : "Yeni Personel Hesabı Oluştur"
        }
        description="Her çalışanın kendi bireysel hesabı olmalıdır. Sunucu tarafında her işlem bu yetkilere göre denetlenir."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ad Soyad *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Ali Vural"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E-Posta Adresi *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ali@depo.com.tr"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {editing
                  ? "Yeni Şifre (Değiştirmek istemiyorsanız boş bırakın)"
                  : "Giriş Şifresi (En az 6 karakter) *"}
              </label>
              <input
                type="password"
                required={!editing}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kullanıcı Rolü *
              </label>
              <select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as "ADMIN" | "EMPLOYEE")
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="EMPLOYEE">Depo Personeli (Kısıtlı Yetki)</option>
                <option value="ADMIN">Sistem Yöneticisi (Tam Yetki)</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              Hesap Aktif (Pasif yapıldığında kullanıcı oturum açamaz)
            </label>
          </div>

          {role === "EMPLOYEE" && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Personel İşlem Yetkileri
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canStockIn}
                    onChange={(e) => setCanStockIn(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Stok Girişi Yapabilir</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canStockOut}
                    onChange={(e) => setCanStockOut(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Stok Çıkışı Yapabilir</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canAdjustStock}
                    onChange={(e) => setCanAdjustStock(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Sayım Düzeltme & Ters Kayıt Yapabilir</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canManageProducts}
                    onChange={(e) => setCanManageProducts(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Ürün Ekleme / Düzenleme / Arşivleme</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canManageCategories}
                    onChange={(e) => setCanManageCategories(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Kategori Yönetimi</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canManageSuppliers}
                    onChange={(e) => setCanManageSuppliers(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Tedarikçi Yönetimi</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canViewReports}
                    onChange={(e) => setCanViewReports(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Raporları Görüntüleyebilir</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canExportData}
                    onChange={(e) => setCanExportData(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>CSV Veri Dışa Aktarabilir</span>
                </label>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Kaydet
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
