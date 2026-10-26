"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Tags,
  Edit2,
  Archive,
  RotateCcw,
  Trash2,
  Loader2,
  Save,
  Package,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatDateTR } from "@/lib/utils";

interface CategoryItem {
  id: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    products: number;
  };
}

export default function CategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [canManageCategories, setCanManageCategories] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryItem | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setCanManageCategories(
            d.user.role === "ADMIN" || d.user.permissions.canManageCategories
          );
        }
      })
      .catch(() => {});
  }, []);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/categories?includeArchived=${String(showArchived)}`
      );
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const openCreateModal = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setErrorMsg(null);
    setModalOpen(true);
  };

  const openEditModal = (cat: CategoryItem) => {
    setEditing(cat);
    setName(cat.name);
    setDescription(cat.description || "");
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const url = editing
        ? `/api/categories/${editing.id}`
        : "/api/categories";
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Kategori kaydedilemedi.");
        return;
      }

      toast({
        type: "success",
        title: editing ? "Kategori Güncellendi" : "Kategori Oluşturuldu",
        message: `${name} kategorisi başarıyla kaydedildi.`,
      });

      setModalOpen(false);
      loadCategories();
    } catch {
      setErrorMsg("Sunucu hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveToggle = async (cat: CategoryItem) => {
    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !cat.isArchived }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          type: "error",
          title: "İşlem Engellendi",
          message: data.error || "Kategori durumu değiştirilemedi.",
        });
        return;
      }
      toast({
        type: "success",
        title: cat.isArchived ? "Kategori Aktifleştirildi" : "Kategori Arşivlendi",
        message: `${cat.name} güncellendi.`,
      });
      loadCategories();
    } catch {
      toast({
        type: "error",
        title: "Hata",
        message: "Sunucu bağlantı hatası.",
      });
    }
  };

  const handleDelete = async (cat: CategoryItem) => {
    if (cat._count.products > 0) {
      toast({
        type: "error",
        title: "Silinemez",
        message: `Bu kategoriye bağlı ${cat._count.products} ürün bulunduğu için kategori silinemez.`,
      });
      return;
    }

    if (
      !window.confirm(
        `"${cat.name}" kategorisini kalıcı olarak silmek istediğinize emin misiniz?`
      )
    )
      return;

    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          type: "error",
          title: "Silinemedi",
          message: data.error || "Kategori silinirken hata oluştu.",
        });
        return;
      }
      toast({
        type: "success",
        title: "Kategori Silindi",
        message: `${cat.name} silindi.`,
      });
      loadCategories();
    } catch {
      toast({
        type: "error",
        title: "Hata",
        message: "Sunucu hatası.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Kategoriler
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Ürün gruplarını yönetin ve kategori bazlı ürün sayılarını inceleyin
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-stone-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-stone-300 text-[#f26522] focus:ring-[#f26522]"
            />
            Arşivlenenleri Göster
          </label>

          {canManageCategories && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#f26522] hover:bg-[#d95619] rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Yeni Kategori Ekle
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-2 text-stone-500">
          <Loader2 className="w-6 h-6 animate-spin text-[#f26522]" />
          <span className="text-xs font-medium">Kategoriler yükleniyor...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className={`bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between ${
                cat.isArchived
                  ? "border-stone-200 bg-stone-50/70 opacity-75"
                  : "border-stone-200/80"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#f26522] flex items-center justify-center shrink-0">
                      <Tags className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-stone-900">
                        {cat.name}
                      </h2>
                      {cat.isArchived && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-stone-200 text-stone-700">
                          Arşivlendi
                        </span>
                      )}
                    </div>
                  </div>

                  <Link
                    href={`/urunler?categoryId=${cat.id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 hover:bg-orange-50 hover:text-[#f26522] transition-colors"
                  >
                    <Package className="w-3.5 h-3.5" />
                    {cat._count.products} Ürün
                  </Link>
                </div>

                <p className="text-xs text-stone-600 mt-3 leading-relaxed">
                  {cat.description || "Açıklama girilmemiş."}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400">
                <span>Güncelleme: {formatDateTR(cat.updatedAt, false)}</span>

                {canManageCategories && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(cat)}
                      title="Kategoriyi Düzenle"
                      className="p-1.5 text-stone-600 hover:text-[#f26522] hover:bg-stone-100 rounded-md"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleArchiveToggle(cat)}
                      title={
                        cat.isArchived ? "Aktifleştir" : "Kategoriyi Arşivle"
                      }
                      className="p-1.5 text-stone-600 hover:text-amber-600 hover:bg-stone-100 rounded-md"
                    >
                      {cat.isArchived ? (
                        <RotateCcw className="w-4 h-4" />
                      ) : (
                        <Archive className="w-4 h-4" />
                      )}
                    </button>

                    {cat._count.products === 0 && (
                      <button
                        type="button"
                        onClick={() => handleDelete(cat)}
                        title="Boş Kategoriyi Sil"
                        className="p-1.5 text-stone-600 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Kategoriyi Düzenle" : "Yeni Kategori Oluştur"}
        description="Ürünlerinizi düzenli sınıflandırmak için kategori adı ve açıklamasını girin."
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Kategori Adı *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Dürbün & Taktik Ekipman"
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-[#f26522]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Açıklama (İsteğe Bağlı)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kategori kapsamındaki ürün türleri..."
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-[#f26522]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
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
