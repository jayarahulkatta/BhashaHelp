import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "BhashaHelp",
  description: "Voice-based government welfare scheme discovery assistant.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
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
