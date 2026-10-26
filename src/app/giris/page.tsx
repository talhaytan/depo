"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight, Loader2, ShieldAlert } from "lucide-react";
import { CavusLogo } from "@/components/brand/CavusLogo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Giriş yapılamadı. Bilgilerinizi kontrol ediniz.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Sunucuya bağlanılamadı. Lütfen tekrar deneyiniz.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="flex justify-center">
          <CavusLogo variant="dark" size="lg" />
        </div>
        <h1 className="mt-4 text-center text-lg font-semibold tracking-tight text-slate-200">
          Çavuş Av Bayii — Tüfek, Fişek & Mühimmat Stok Takip Sistemi
        </h1>
        <p className="mt-1 text-center text-xs text-slate-400">
          Yetkili bayi yöneticisi veya personel hesabınızla oturum açın
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-200 sm:px-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs font-medium text-rose-700"
              >
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Kurumsal E-Posta Adresi
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@depo.com.tr"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Şifre
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Oturum Aç</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Role Credentials for Testing / Evaluation */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
              Hızlı Test Hesapları (Tek Tıkla Doldur)
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => fillDemoAccount("admin@depo.com.tr", "Admin123!")}
                className="text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-colors flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-900 block">
                    Sistem Yöneticisi (Tam Yetki)
                  </span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    admin@depo.com.tr
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold text-[10px]">
                  YÖNETİCİ
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  fillDemoAccount("sorumlu@depo.com.tr", "Personel123!")
                }
                className="text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-colors flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-900 block">
                    Depo Sorumlusu (Ürün + Sayım + Rapor)
                  </span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    sorumlu@depo.com.tr
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-semibold text-[10px]">
                  SORUMLU
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  fillDemoAccount("personel@depo.com.tr", "Personel123!")
                }
                className="text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-colors flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-900 block">
                    Depo Personeli (Stok Giriş / Çıkış)
                  </span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    personel@depo.com.tr
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                  PERSONEL
                </span>
              </button>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Güvenlik nedeniyle dışarıya açık yönetici kayıt sayfası bulunmamaktadır.
          Yeni personel hesapları yalnızca Sistem Yöneticisi tarafından tanımlanır.
        </p>
      </div>
    </div>
  );
}
