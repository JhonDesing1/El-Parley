import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, DM_Sans, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { Suspense } from "react";
import { QueryProvider } from "@/components/providers/query-provider";
import { PostHogProvider, PostHogPageView } from "@/components/providers/posthog-provider";
import { OneSignalProvider } from "@/components/providers/onesignal-provider";
import { siteConfig } from "@/config/site";
import "./globals.css";

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: `%s · ${siteConfig.name}` },
  description: siteConfig.description,
  keywords: [
    "value bets",
    "apuestas deportivas",
    "casas de apuestas Colombia",
    "comparador de cuotas",
    "parlays",
    "Liga BetPlay",
    "Champions League",
    "Colombia",
  ],
  authors: [{ name: siteConfig.name }],
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#060810" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${barlowCondensed.variable} ${dmSans.variable} ${jetbrains.variable}`}
    >
      <body className="font-sans">
        <PostHogProvider>
          <OneSignalProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
              <QueryProvider>
                <Suspense fallback={null}>
                  <PostHogPageView />
                </Suspense>
                {children}
                <Toaster position="top-right" theme="dark" richColors />
              </QueryProvider>
            </ThemeProvider>
          </OneSignalProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
