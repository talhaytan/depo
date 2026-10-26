"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Truck,
  Phone,
  Mail,
  MapPin,
  User,
  Edit2,
  Package,
  ArrowDownLeft,
  Loader2,
  Save,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDateTR, formatQuantity } from "@/lib/utils";

interface SupplierRecord {
  id: string;
  companyName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isArchived: boolean;
  products: Array<{
    id: string;
    name: string;
    sku: string;
    quantity: number;
    unit: string;
  }>;
  movements: Array<{
    id: string;
    movementCode: string;
    quantity: number;
    unitCost: number | null;
    referenceNo: string | null;
    createdAt: string;
    product: { id: string; name: string; sku: string; unit: string };
    user: { id: string; name: string };
  }>;
  _count: {
    products: number;
    movements: number;
  };
}

export default function SuppliersPage() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManageSuppliers, setCanManageSuppliers] = useState(false);

  // Detail modal
  const [detailSupplier, setDetailSupplier] = useState<SupplierRecord | null>(
    null
  );

  // Create / Edit modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierRecord | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setCanManageSuppliers(
            d.user.role === "ADMIN" || d.user.permissions.canManageSuppliers
          );
        }
      })
      .catch(() => {});
  }, []);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/suppliers");
      if (res.ok) {
        const data = await res.json();
        const list: SupplierRecord[] = data.suppliers || [];
        setSuppliers(list);
        setDetailSupplier((prev) =>
          prev ? list.find((s) => s.id === prev.id) || null : null
        );
      }
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const openCreate = () => {
    setEditing(null);
    setCompanyName("");
    setContactPerson("");
    setPhone("");
    setEmail("");
    setAddress("");
    setNotes("");
    setErrorMsg(null);
    setFormOpen(true);
  };

  const openEdit = (sup: SupplierRecord) => {
    setEditing(sup);
    setCompanyName(sup.companyName);
    setContactPerson(sup.contactPerson || "");
    setPhone(sup.phone || "");
    setEmail(sup.email || "");
    setAddress(sup.address || "");
    setNotes(sup.notes || "");
    setErrorMsg(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const url = editing ? `/api/suppliers/${editing.id}` : "/api/suppliers";
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          contactPerson,
          phone,
          email,
          address,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Tedarikçi kaydedilemedi.");
        return;
      }

      toast({
        type: "success",
        title: editing ? "Tedarikçi Güncellendi" : "Yeni Tedarikçi Eklendi",
        message: `${companyName} başarıyla kaydedildi.`,
      });

      setFormOpen(false);
      loadSuppliers();
    } catch {
      setErrorMsg("Sunucu hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Tedarikçiler
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Tedarikçi firmaları, iletişim bilgilerini, bağlı ürünleri ve geçmiş mal kabul kayıtlarını görüntüleyin
          </p>
        </div>

        {canManageSuppliers && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#f26522] hover:bg-[#d95619] rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Tedarikçi Ekle
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-2 text-stone-500">
          <Loader2 className="w-6 h-6 animate-spin text-[#f26522]" />
          <span className="text-xs font-medium">Tedarikçiler yükleniyor...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {suppliers.map((sup) => (
            <div
              key={sup.id}
              className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#f26522] flex items-center justify-center shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-stone-900">
                        {sup.companyName}
                      </h2>
                      {sup.contactPerson && (
                        <p className="text-xs text-stone-600 flex items-center gap-1 mt-0.5">
                          <User className="w-3.5 h-3.5 text-stone-400" />
                          Yetkili: {sup.contactPerson}
                        </p>
                      )}
                    </div>
                  </div>

                  {canManageSuppliers && (
                    <button
                      type="button"
                      onClick={() => openEdit(sup)}
                      className="p-1.5 text-stone-500 hover:text-[#f26522] hover:bg-stone-100 rounded-md"
                      title="Tedarikçiyi Düzenle"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-600">
                  {sup.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span>{sup.phone}</span>
                    </div>
                  )}
                  {sup.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{sup.email}</span>
                    </div>
                  )}
                  {sup.address && (
                    <div className="sm:col-span-2 flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                      <span>{sup.address}</span>
                    </div>
                  )}
                </div>

                {sup.notes && (
                  <p className="mt-3 p-2.5 rounded-xl bg-stone-50 border border-stone-100 text-xs text-stone-600">
                    {sup.notes}
                  </p>
                )}
              </div>

              <div className="mt-5 pt-3.5 border-t border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold text-stone-700">
                    <Package className="w-3.5 h-3.5 text-[#f26522]" />
                    {sup._count.products} Bağlı Ürün
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-stone-700">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                    {sup._count.movements} Stok Girişi
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setDetailSupplier(sup)}
                  className="text-xs font-semibold text-[#f26522] hover:text-[#d95619]"
                >
                  Ürünler & Giriş Geçmişi →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Supplier Detail Modal (Associated Products & Stock-In History) */}
      <Modal
        open={Boolean(detailSupplier)}
        onClose={() => setDetailSupplier(null)}
        title={detailSupplier?.companyName || "Tedarikçi Detayı"}
        description="Bu tedarikçiye bağlı ürünler ve geçmiş mal kabul (stok girişi) kayıtları"
        maxWidth="2xl"
      >
        {detailSupplier && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                Bağlı Ürünler ({detailSupplier.products.length})
              </h3>
              {detailSupplier.products.length === 0 ? (
                <p className="text-xs text-stone-500">
                  Bu tedarikçiye bağlı ürün bulunmuyor.
                </p>
              ) : (
                <div className="border border-stone-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Ürün Adı</th>
                        <th className="py-2 px-3">SKU</th>
                        <th className="py-2 px-3 text-right">Mevcut Stok</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {detailSupplier.products.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2 px-3 font-medium">
                            <Link
                              href={`/urunler/${p.id}`}
                              onClick={() => setDetailSupplier(null)}
                              className="text-[#f26522] hover:underline"
                            >
                              {p.name}
                            </Link>
                          </td>
                          <td className="py-2 px-3 font-mono text-stone-500">
                            {p.sku}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold">
                            {formatQuantity(p.quantity, p.unit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                Son Mal Kabul / Stok Giriş Kayıtları
              </h3>
              {detailSupplier.movements.length === 0 ? (
                <p className="text-xs text-stone-500">
                  Bu tedarikçiden henüz stok girişi kaydedilmemiş.
                </p>
              ) : (
                <div className="border border-stone-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-600">
                      <tr>
                        <th className="py-2 px-3">Tarih / Belge</th>
                        <th className="py-2 px-3">Ürün</th>
                        <th className="py-2 px-3">Miktar</th>
                        <th className="py-2 px-3">Birim Maliyet</th>
                        <th className="py-2 px-3">Personel</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {detailSupplier.movements.map((m) => (
                        <tr key={m.id}>
                          <td className="py-2 px-3">
                            <span className="block font-medium text-stone-900">
                              {formatDateTR(m.createdAt)}
                            </span>
                            <span className="text-[11px] font-mono text-stone-500">
                              {m.referenceNo || m.movementCode}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-medium text-stone-900">
                            {m.product.name}
                          </td>
                          <td className="py-2 px-3 font-bold text-emerald-700">
                            +{formatQuantity(m.quantity, m.product.unit)}
                          </td>
                          <td className="py-2 px-3">
                            {m.unitCost !== null
                              ? formatCurrency(m.unitCost)
                              : "-"}
                          </td>
                          <td className="py-2 px-3 text-stone-600">
                            {m.user.name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Create / Edit Supplier Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Tedarikçi Bilgilerini Düzenle" : "Yeni Tedarikçi Ekle"}
        description="Tedarikçi firma unvanı ve iletişim bilgilerini kaydedin."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Firma Adı / Unvanı *
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Örn: YAF / Züber Mühimmat Dağıtım A.Ş."
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                İlgili Kişi / Yetkili
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Örn: Serkan Aydın"
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Telefon
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Örn: 0212 555 10 20"
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              E-Posta Adresi
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="siparis@firma.com.tr"
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Adres
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Açık adres bilgisi..."
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Notlar
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sevkiyat günleri, ödeme vadesi veya özel koşullar..."
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-200 rounded-xl hover:bg-stone-50"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#f26522] hover:bg-[#d95619] rounded-xl shadow-sm disabled:opacity-50"
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
