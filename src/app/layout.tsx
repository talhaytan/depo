import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Çavuş Av Bayii — Tüfek, Fişek, Mermi ve Malzeme Stok Yönetimi",
  description:
    "Çavuş Av Bayii için av tüfekleri, fişek, mermi, optik ve av malzemeleri stok takibi, giriş/çıkış ve kritik stok uyarı sistemi.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
