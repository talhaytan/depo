"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  isDirty?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = "lg",
  isDirty = false,
}: ModalProps) {
  const handleSafeClose = () => {
    if (isDirty) {
      const confirmed = window.confirm(
        "Kaydedilmemiş değişiklikleriniz var. Çıkmak istediğinize emin misiniz?"
      );
      if (!confirmed) return;
    }
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        handleSafeClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (!open) return null;

  const widthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  }[maxWidth];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/55 backdrop-blur-[2px] animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={cn(
          "bg-white rounded-t-3xl sm:rounded-2xl border-t sm:border border-stone-200 shadow-2xl w-full overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]",
          widthClass
        )}
      >
        {/* Mobile bottom-sheet grab handle */}
        <div className="w-10 h-1.5 bg-stone-300 rounded-full mx-auto mt-2.5 mb-0.5 sm:hidden shrink-0" />

        <div className="flex items-start justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-100 bg-stone-50/60 shrink-0">
          <div>
            <h2 id="modal-title" className="text-base font-bold text-stone-900">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-stone-500 mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSafeClose}
            aria-label="Kapat"
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-xl hover:bg-stone-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#f26522]/40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
