import React from "react";
import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import "./typography.css";
import "./orion.css";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { ButtonFx } from "../components/ButtonFx";
import { Web3Provider } from "../providers/Web3Provider";
import { ThemeProvider, THEME_INIT_SCRIPT } from "../providers/ThemeProvider";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

// Absolute URL for social previews; relative paths are used when unset.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const title = "ORIONMARKETS | Find your edge.";
const description =
  "Tokenized equities at the core. Leverage and credit around them. Long, short and borrow against tokenized stocks on Robinhood Chain.";

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: { default: title, template: "%s | ORIONMARKETS" },
  description,
  applicationName: "ORIONMARKETS",
  openGraph: {
    type: "website",
    siteName: "ORIONMARKETS",
    title,
    description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "ORIONMARKETS: Find your edge." }],
  },
  twitter: { card: "summary_large_image", site: "@UseOrionMarkets", title, description, images: ["/og.png"] },
};

// Dark is the default theme; ThemeProvider keeps this tag in step when the visitor switches.
export const viewport: Viewport = {
  themeColor: "#070b0a",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={archivo.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-page text-fg min-h-screen flex flex-col font-sans selection:bg-accent selection:text-on-accent antialiased">
        <ThemeProvider>
          <Web3Provider>
            <ButtonFx />
            <Header />
            <main id="main" className="flex-1 w-full mx-auto pt-[var(--header-h)]">
              {children}
            </main>
            <Footer />
          </Web3Provider>
        </ThemeProvider>
      </body>
    </html>
  );
}
