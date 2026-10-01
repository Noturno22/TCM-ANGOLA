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
  metadataBase: new URL("https://tira-o-coco-do-meio.vercel.app"),
  title: {
    default: "Tira o Cocó do Meio — Jogo de Estratégia Angolano",
    template: "%s • Tira o Cocó do Meio",
  },
  description:
    "O clássico jogo de estratégia angolano, agora online. Joga contra a IA, desafia amigos, participa em torneios. Disponível em Português, Inglês e Francês.",
  keywords: [
    "Tira o Cocó do Meio",
    "jogo angolano",
    "jogo de estratégia",
    "jogo de tabuleiro",
    "board game",
    "strategy game",
    "Africa",
    "Angola",
    "jogo online",
    "online game",
    "jogo Africa",
  ],
  authors: [{ name: "Tira o Cocó do Meio" }],
  creator: "Tira o Cocó do Meio",
  publisher: "Tira o Cocó do Meio",
  applicationName: "Tira o Cocó do Meio",
  category: "Games",
  classification: "Games",
  openGraph: {
    title: "Tira o Cocó do Meio — Jogo de Estratégia Angolano",
    description: "Estratégia • Movimento • Conquista. Joga online contra jogadores de todo o mundo ou desafia a IA.",
    type: "website",
    locale: "pt_PT",
    alternateLocale: ["en_US", "fr_FR"],
    siteName: "Tira o Cocó do Meio",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Tira o Cocó do Meio — Jogo de Estratégia Angolano",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tira o Cocó do Meio",
    description: "O clássico jogo de estratégia angolano. Joga online!",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
    languages: {
      "pt-PT": "/",
      "en-US": "/",
      "fr-FR": "/",
    },
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tira o Cocó do Meio",
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT" suppressHydrationWarning className="light">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Game",
              name: "Tira o Cocó do Meio",
              description: "Jogo de estratégia abstrata para 2 jogadores, inspirado na cultura angolana.",
              genre: "Strategy",
              gamePlatform: "Web Browser",
              numberOfPlayers: "2",
              inLanguage: ["pt", "en", "fr"],
              applicationCategory: "Game",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              publisher: {
                "@type": "Organization",
                name: "Tira o Cocó do Meio",
              },
            }),
          }}
        />
      </head>
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
