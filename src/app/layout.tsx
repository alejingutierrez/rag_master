import type { Metadata } from "next";
import { Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AppShell } from "@/components/layout/app-shell";
import "@/lib/dayjs-config";
import "./globals.css";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Archivo Histórico Digital · Colombia",
  description:
    "Plataforma de investigación con RAG, agentes y búsqueda semántica sobre la historia de Colombia.",
};

// Script bloqueante para fijar tema antes del primer paint y evitar flash
const themeBootstrap = `
(function(){
  try {
    var m = localStorage.getItem('rag-master-theme-mode');
    var r = m === 'light' || m === 'dark'
      ? m
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', r);
    document.documentElement.style.colorScheme = r;
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
        <AntdRegistry>
          <ThemeProvider>
            <AppShell>{children}</AppShell>
          </ThemeProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
