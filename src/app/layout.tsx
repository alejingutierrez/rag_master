import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AppShell } from "@/components/layout/app-shell";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { SITE_URL, SITE_NAME, AUTHOR, DEFAULT_OG_IMAGE } from "@/lib/site";
import "@/lib/dayjs-config";
import "./globals.css";

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const SITE_TAGLINE = "Una historia de Colombia citable y abierta a la consulta.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Historia de Colombia · Archivo abierto y citable",
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "Una historia de Colombia vectorizada, citable, abierta a la consulta. Investigación con fuentes, agentes y producción académica.",
  applicationName: SITE_NAME,
  authors: [{ name: AUTHOR }],
  creator: AUTHOR,
  publisher: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "es_CO",
    url: SITE_URL,
    title: "Historia de Colombia",
    description: SITE_TAGLINE,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Historia de Colombia",
    description: SITE_TAGLINE,
    images: [DEFAULT_OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://use.typekit.net" />
        <link rel="preconnect" href="https://p.typekit.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://use.typekit.net/eug6imx.css" />
      </head>
      <body className={mono.variable}>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
