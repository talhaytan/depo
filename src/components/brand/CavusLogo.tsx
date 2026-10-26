"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Çavuş Av Bayii Resmi Vektör Logosu (Amblem + Tipografi)
 * Ekteki kurumsal logonun birebir ölçeklenebilir SVG temsili.
 */
export function CavusLogo({
  collapsed = false,
  variant = "dark",
  size = "md",
  className,
}: {
  collapsed?: boolean;
  variant?: "dark" | "light"; // dark = for dark backgrounds (white logo), light = for white backgrounds (black logo)
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const fillColor = variant === "dark" ? "#ffffff" : "#0f172a";
  const subColor = variant === "dark" ? "#cbd5e1" : "#334155";

  const iconSize =
    size === "sm" ? "w-8 h-9" : size === "lg" ? "w-12 h-14" : "w-9 h-10";

  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      {/* Çavuş Rütbe / Kalkan C Amblemi */}
      <svg
        viewBox="0 0 100 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(iconSize, "shrink-0")}
        aria-hidden="true"
      >
        {/* Üst C-Kalkan Gövdesi */}
        <path
          d="M10 8 H90 V46 H68 V28 H32 V63 L50 77 L90 46 V70 L50 100 L10 70 Z"
          fill={fillColor}
        />
        {/* Alt Çavuş Şeridi (Chevron) */}
        <path
          d="M10 77 L50 107 L90 77 V93 L50 122 L10 93 Z"
          fill={fillColor}
        />
      </svg>

      {!collapsed && (
        <div className="flex items-baseline gap-1.5 leading-none">
          <span
            className={cn(
              "font-black tracking-tight lowercase",
              size === "sm"
                ? "text-xl"
                : size === "lg"
                ? "text-3xl"
                : "text-2xl",
              variant === "dark" ? "text-white" : "text-slate-900"
            )}
            style={{ letterSpacing: "-0.03em" }}
          >
            çavuş
          </span>
          <div
            className={cn(
              "flex flex-col font-normal lowercase leading-[1.05]",
              size === "sm"
                ? "text-[10px]"
                : size === "lg"
                ? "text-sm"
                : "text-[11px]"
            )}
            style={{ color: subColor }}
          >
            <span>av</span>
            <span>bayii</span>
          </div>
        </div>
      )}
    </div>
  );
}
