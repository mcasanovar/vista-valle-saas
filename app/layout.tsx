import type { Metadata } from "next";
import { DM_Serif_Display, Montserrat } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import {
  getServerEnvironment,
  validateRuntimeEnvironment,
} from "@/config/server";
import { createPublicMetadata } from "@/seo/public-metadata";
import "./globals.css";

const dmSerifDisplay = DM_Serif_Display({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-dm-serif-display",
  weight: "400",
});

const montserrat = Montserrat({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["400", "500", "600", "700"],
});

const siteUrl = getServerEnvironment().SITE_URL;

export const metadata: Metadata = createPublicMetadata(siteUrl);

const THEME_INIT_SCRIPT = `try{if(localStorage.getItem('vv-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  validateRuntimeEnvironment();

  return (
    <html lang="es">
      <body className={`${montserrat.variable} ${dmSerifDisplay.variable}`}>
        <Script id="vv-theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
