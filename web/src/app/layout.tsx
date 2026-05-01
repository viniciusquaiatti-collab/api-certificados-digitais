import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// =============================
// FONTS
// =============================
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// =============================
// METADATA
// =============================
export const metadata: Metadata = {
  title: "NexaSpark",
  description: "Sistema de certificação digital",
};

// =============================
// DEBUG (SERVER SIDE)
// =============================
console.log("🚀 [LAYOUT] Inicializando RootLayout...");
console.log("🌐 [LAYOUT] Ambiente:", process.env.NODE_ENV);

// =============================
// ROOT LAYOUT
// =============================
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">

        {/* DEBUG VISUAL (CLIENT SAFE) */}
        {process.env.NODE_ENV === "development" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                console.log("🧪 [CLIENT] Layout carregado no browser");
                console.log("🌍 [CLIENT] Idioma do navegador:", navigator.language);
                console.log("🕒 [CLIENT] Timezone:", Intl.DateTimeFormat().resolvedOptions().timeZone);
              `,
            }}
          />
        )}

        {children}

      </body>
    </html>
  );
}