import type { Metadata, Viewport } from "next";
import { Inter, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tira o Cocó do Meio — Jogo de Estratégia Angolano",
  description:
    "O clássico jogo de estratégia angolano, agora online. Estratégia, movimento e conquista. Joga online, desafIA a IA ou joga com amigos.",
  keywords: [
    "Tira o Cocó do Meio",
    "jogo angolano",
    "jogo de estratégia",
    "jogo de tabuleiro",
    "África",
    "Angola",
  ],
  authors: [{ name: "Tira o Cocó do Meio" }],
  openGraph: {
    title: "Tira o Cocó do Meio",
    description: "Estratégia • Movimento • Conquista. Um jogo angolano para todas as gerações.",
    type: "website",
    locale: "pt_PT",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0E0B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT" suppressHydrationWarning className="dark">
      <body
        className={`${inter.variable} ${bebas.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
        <Sonner />
      </body>
    </html>
  );
}
