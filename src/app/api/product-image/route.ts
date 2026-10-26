import { NextResponse } from "next/server";

const BRAND_THEMES: Record<
  string,
  { bg1: string; bg2: string; accent: string; brass: string; text: string }
> = {
  STERLING: {
    bg1: "#1e293b",
    bg2: "#0f172a",
    accent: "#dc2626",
    brass: "#d97706",
    text: "#ffffff",
  },
  MESCO: {
    bg1: "#7f1d1d",
    bg2: "#450a0a",
    accent: "#f59e0b",
    brass: "#eab308",
    text: "#ffffff",
  },
  ZUBER: {
    bg1: "#064e3b",
    bg2: "#022c22",
    accent: "#10b981",
    brass: "#f59e0b",
    text: "#ffffff",
  },
  COM: {
    bg1: "#312e81",
    bg2: "#1e1b4b",
    accent: "#6366f1",
    brass: "#eab308",
    text: "#ffffff",
  },
  CLK: {
    bg1: "#3f3f46",
    bg2: "#18181b",
    accent: "#f97316",
    brass: "#eab308",
    text: "#ffffff",
  },
  CODEX: {
    bg1: "#1e3a8a",
    bg2: "#172554",
    accent: "#38bdf8",
    brass: "#f59e0b",
    text: "#ffffff",
  },
  OZKURSAN: {
    bg1: "#7c2d12",
    bg2: "#431407",
    accent: "#fb923c",
    brass: "#eab308",
    text: "#ffffff",
  },
  MEGA: {
    bg1: "#881337",
    bg2: "#4c0519",
    accent: "#f43f5e",
    brass: "#f59e0b",
    text: "#ffffff",
  },
  BUGATTI: {
    bg1: "#0c4a6e",
    bg2: "#082f49",
    accent: "#0ea5e9",
    brass: "#eab308",
    text: "#ffffff",
  },
  YAF: {
    bg1: "#14532d",
    bg2: "#052e16",
    accent: "#22c55e",
    brass: "#eab308",
    text: "#ffffff",
  },
  RC: {
    bg1: "#1c1917",
    bg2: "#0c0a09",
    accent: "#eab308",
    brass: "#f59e0b",
    text: "#ffffff",
  },
  BP: {
    bg1: "#422006",
    bg2: "#1c1917",
    accent: "#d97706",
    brass: "#facc15",
    text: "#ffffff",
  },
  FIOCCHI: {
    bg1: "#1e3a8a",
    bg2: "#0f172a",
    accent: "#ef4444",
    brass: "#eab308",
    text: "#ffffff",
  },
  BORNAGHI: {
    bg1: "#3b0764",
    bg2: "#1e1b4b",
    accent: "#c084fc",
    brass: "#facc15",
    text: "#ffffff",
  },
  MIRAGE: {
    bg1: "#0f766e",
    bg2: "#042f2e",
    accent: "#2dd4bf",
    brass: "#eab308",
    text: "#ffffff",
  },
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") || "shell"; // "shell" | "rifle"
  const brand = (searchParams.get("brand") || "STERLING").trim();
  const model = (searchParams.get("model") || "Standart").trim();
  const caliber = (searchParams.get("caliber") || "12").trim();
  const gram = (searchParams.get("gram") || "32").trim();
  const shot = (searchParams.get("shot") || "").trim();

  const brandKey = brand
    .toUpperCase()
    .replace(/Ö/g, "O")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/İ/g, "I")
    .replace(/Ç/g, "C")
    .replace(/Ğ/g, "G");

  const theme = BRAND_THEMES[brandKey] || {
    bg1: "#1e293b",
    bg2: "#0f172a",
    accent: "#2563eb",
    brass: "#d97706",
    text: "#ffffff",
  };

  if (kind === "rifle") {
    const svgRifle = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220" width="320" height="220">
      <defs>
        <linearGradient id="rbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <rect width="320" height="220" rx="16" fill="url(#rbg)"/>
      <rect x="12" y="12" width="296" height="196" rx="12" fill="none" stroke="#334155" stroke-width="1.5"/>
      <!-- Rifle Silhouette -->
      <g transform="translate(28, 78)">
        <!-- Stock (Walnut) -->
        <path d="M0 32 L58 18 L64 36 L8 52 Z" fill="#92400e"/>
        <!-- Receiver -->
        <rect x="58" y="15" width="54" height="18" rx="3" fill="#94a3b8"/>
        <!-- Barrel & Rib -->
        <rect x="112" y="17" width="150" height="6" rx="2" fill="#cbd5e1"/>
        <rect x="112" y="25" width="95" height="6" rx="2" fill="#64748b"/>
        <!-- Forend -->
        <path d="M112 24 L176 24 L170 35 L112 35 Z" fill="#b45309"/>
        <!-- Trigger Guard -->
        <path d="M68 33 Q76 45 86 33" fill="none" stroke="#94a3b8" stroke-width="2.5"/>
      </g>
      <text x="24" y="42" fill="#f59e0b" font-family="system-ui, sans-serif" font-size="13" font-weight="800" letter-spacing="1">${escapeXml(
        brand.toUpperCase()
      )}</text>
      <text x="24" y="64" fill="#ffffff" font-family="system-ui, sans-serif" font-size="17" font-weight="700">${escapeXml(
        model
      )}</text>
      <rect x="24" y="164" width="90" height="26" rx="6" fill="#f59e0b"/>
      <text x="69" y="181" text-anchor="middle" fill="#0f172a" font-family="system-ui, sans-serif" font-size="12" font-weight="800">${escapeXml(
        caliber
      )} KALİBRE</text>
      <text x="292" y="181" text-anchor="end" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11" font-weight="600">ÇAVUŞ AV BAYİİ</text>
    </svg>`;

    return new NextResponse(svgRifle, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // Shotgun Shell Box + Brass Cartridge Illustration
  const shotBadge = shot ? `NO: ${shot}` : "TEK KURŞUN";

  const svgShell = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220" width="320" height="220">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${theme.bg1}"/>
        <stop offset="100%" stop-color="${theme.bg2}"/>
      </linearGradient>
      <linearGradient id="brassGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#b45309"/>
        <stop offset="50%" stop-color="#facc15"/>
        <stop offset="100%" stop-color="#b45309"/>
      </linearGradient>
      <linearGradient id="hullGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${theme.accent}"/>
        <stop offset="50%" stop-color="#ffffff" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="${theme.accent}"/>
      </linearGradient>
    </defs>

    <!-- Card Background -->
    <rect width="320" height="220" rx="16" fill="url(#bg)"/>
    <rect x="10" y="10" width="300" height="200" rx="12" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="1.5"/>

    <!-- Top Accent Ribbon -->
    <path d="M10 48 H215 L198 72 H10 Z" fill="${theme.accent}"/>
    <text x="22" y="36" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="900" letter-spacing="1.2">${escapeXml(
      brand.toUpperCase()
    )}</text>
    <text x="22" y="65" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" letter-spacing="0.5">${escapeXml(
      model.toUpperCase()
    )}</text>

    <!-- Caliber & Gram Specs -->
    <g transform="translate(22, 92)">
      <rect x="0" y="0" width="76" height="46" rx="8" fill="#ffffff" fill-opacity="0.1" stroke="#ffffff" stroke-opacity="0.2"/>
      <text x="38" y="18" text-anchor="middle" fill="#cbd5e1" font-family="system-ui, sans-serif" font-size="9" font-weight="700">KALİBRE</text>
      <text x="38" y="37" text-anchor="middle" fill="#ffffff" font-family="system-ui, sans-serif" font-size="16" font-weight="900">${escapeXml(
        caliber
      )} CAL</text>

      <rect x="86" y="0" width="86" height="46" rx="8" fill="#ffffff" fill-opacity="0.1" stroke="#ffffff" stroke-opacity="0.2"/>
      <text x="129" y="18" text-anchor="middle" fill="#cbd5e1" font-family="system-ui, sans-serif" font-size="9" font-weight="700">GRAMAJ</text>
      <text x="129" y="37" text-anchor="middle" fill="#facc15" font-family="system-ui, sans-serif" font-size="16" font-weight="900">${escapeXml(
        gram
      )} GR</text>
    </g>

    <!-- Shot Number Pill -->
    <rect x="22" y="152" width="172" height="32" rx="8" fill="#0f172a" fill-opacity="0.65" stroke="${
      theme.brass
    }" stroke-width="1.5"/>
    <text x="108" y="173" text-anchor="middle" fill="#facc15" font-family="system-ui, sans-serif" font-size="12" font-weight="800">SAÇMA ${escapeXml(
      shotBadge
    )}</text>

    <!-- Realistic 12-Gauge Shotgun Shell Illustration on the Right -->
    <g transform="translate(234, 28)">
      <!-- Shadow -->
      <rect x="8" y="6" width="48" height="160" rx="6" fill="#000000" fill-opacity="0.35"/>
      <!-- Crimp Top -->
      <rect x="4" y="0" width="44" height="8" rx="2" fill="${theme.accent}" opacity="0.85"/>
      <!-- Plastic Hull Body -->
      <rect x="2" y="6" width="48" height="106" rx="3" fill="${theme.accent}"/>
      <rect x="2" y="6" width="48" height="106" rx="3" fill="url(#hullGrad)"/>
      <!-- Hull Text Print -->
      <text x="26" y="45" text-anchor="middle" fill="#ffffff" fill-opacity="0.9" font-family="monospace" font-size="9" font-weight="800">${escapeXml(
        brand.slice(0, 7).toUpperCase()
      )}</text>
      <text x="26" y="62" text-anchor="middle" fill="#ffffff" fill-opacity="0.95" font-family="monospace" font-size="11" font-weight="900">${escapeXml(
        gram
      )}g</text>
      <text x="26" y="78" text-anchor="middle" fill="#ffffff" fill-opacity="0.8" font-family="monospace" font-size="8" font-weight="700">${escapeXml(
        caliber
      )} GA</text>
      <!-- High Brass Base -->
      <rect x="1" y="112" width="50" height="44" rx="2" fill="url(#brassGrad)"/>
      <line x1="1" y1="120" x2="51" y2="120" stroke="#78350f" stroke-width="1" stroke-opacity="0.5"/>
      <!-- Brass Rim -->
      <rect x="-2" y="154" width="56" height="8" rx="3" fill="url(#brassGrad)" stroke="#78350f" stroke-width="1"/>
    </g>
  </svg>`;

  return new NextResponse(svgShell, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
