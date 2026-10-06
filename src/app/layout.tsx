import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { Noto_Sans } from "next/font/google";
const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "BhashaHelp — Find Government Schemes in Your Language",
    template: "%s | BhashaHelp",
  },
  description:
    "Voice-powered assistant to discover and apply for Indian government welfare schemes in Telugu, Hindi, and English. Free, verified, and accessible.",
  keywords: [
    "government schemes",
    "welfare schemes India",
    "Telugu schemes",
    "Hindi schemes",
    "Telangana schemes",
    "BhashaHelp",
    "voice assistant",
    "सरकारी योजनाएं",
    "ప్రభుత్వ పథకాలు",
  ],
  authors: [{ name: "BhashaHelp Team" }],
  openGraph: {
    title: "BhashaHelp — Government Schemes in Your Language",
    description:
      "Ask about any government welfare scheme in Telugu, Hindi, or English. Voice-first, mobile-friendly.",
    siteName: "BhashaHelp",
    locale: "en_IN",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FF9933" },
    { media: "(prefers-color-scheme: dark)", color: "#1e293b" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSans.variable} h-full antialiased`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        <AuthProvider>
          <LanguageProvider>
            <div className="flex-1 w-full h-full bg-white shadow-md flex flex-col min-w-[320px]">
              {children}
            </div>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
