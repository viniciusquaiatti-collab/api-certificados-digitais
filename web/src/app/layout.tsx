// ============================================================
// 🏢 NexaSpark — /app/layout.tsx v2.0
//
// MUDANÇAS v2.0:
//   - Geist → Space Grotesk + JetBrains Mono (identidade Echo)
//   - Variáveis CSS: --font-space-grotesk + --font-jetbrains-mono
//     (usadas pelo globals.css via var(--font-sans) / var(--font-mono))
//   - Metadata enriquecida (OG, description, theme-color)
//   - Logs server-side preservados + enriquecidos
//   - suppressHydrationWarning mantido
// ============================================================

import type { Metadata }          from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// ============================================================
// 🖋️  FONTES — Space Grotesk + JetBrains Mono
// Identidade visual do NexaSpark Echo
// ============================================================
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets:  ["latin"],
  weight:   ["300", "400", "500", "600", "700"],
  display:  "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets:  ["latin"],
  weight:   ["400", "500", "600"],
  display:  "swap",
});

// ============================================================
// 🏷️  METADATA
// ============================================================
export const metadata: Metadata = {
  title:       "NexaSpark — Infraestrutura de Certificação Digital",
  description: "Plataforma enterprise para emissão de certificados com hash SHA-256, validação pública em tempo real e rastreabilidade total.",
  keywords:    ["certificado digital", "SHA-256", "validação", "NexaSpark", "infraestrutura"],
  authors:     [{ name: "NexaSpark" }],
  openGraph: {
    title:       "NexaSpark — Infraestrutura de Certificação Digital",
    description: "Emissão criptográfica de certificados verificáveis em tempo real.",
    type:        "website",
    locale:      "pt_BR",
  },
  twitter: {
    card:        "summary",
    title:       "NexaSpark",
    description: "Infraestrutura cinematográfica para confiança verificável.",
  },
  // ✅ themeColor movido para generateViewport() — Next.js 14+ exige separação
};

// ============================================================
// 🎨 VIEWPORT — themeColor aqui, separado do metadata
// ✅ Elimina o warning: "Unsupported metadata themeColor"
// ============================================================
export function generateViewport() {
  return {
    themeColor: "#030508",
  };
}

// ============================================================
// 🐛 DEBUG SERVER-SIDE
// ============================================================
console.log("🚀 [LAYOUT] Inicializando RootLayout v2.0...");
console.log("🌐 [LAYOUT] Ambiente:", process.env.NODE_ENV);
console.log("🖋️  [LAYOUT] Fontes: Space Grotesk + JetBrains Mono");

// ============================================================
// 🏠 ROOT LAYOUT
// ============================================================
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  console.log("🧱 [LAYOUT] Renderizando estrutura base...");

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`
        ${spaceGrotesk.variable}
        ${jetbrainsMono.variable}
        h-full antialiased
      `}
    >
      <head>
        {/* Preconnect para Google Fonts (otimiza carregamento) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>

      <body className="min-h-full flex flex-col">

        {/* Debug client-side — só em development */}
        {process.env.NODE_ENV === "development" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                console.log("%c🏢 [NexaSpark:Layout]%c RootLayout v2.0 carregado no browser", "color:#34d399;font-weight:bold;", "color:inherit;");
                console.log("%c🌍 [NexaSpark:Layout]%c Idioma: " + navigator.language, "color:#60a5fa;font-weight:bold;", "color:inherit;");
                console.log("%c🕒 [NexaSpark:Layout]%c Timezone: " + Intl.DateTimeFormat().resolvedOptions().timeZone, "color:#60a5fa;font-weight:bold;", "color:inherit;");
                console.log("%c🖋️  [NexaSpark:Layout]%c Fontes: Space Grotesk + JetBrains Mono", "color:#a78bfa;font-weight:bold;", "color:inherit;");
                console.log("%c🎨 [NexaSpark:Layout]%c Design system: NexaSpark Echo (Lovable) → Next.js", "color:#f472b6;font-weight:bold;", "color:inherit;");
              `,
            }}
          />
        )}

        {children}

      </body>
    </html>
  );
}