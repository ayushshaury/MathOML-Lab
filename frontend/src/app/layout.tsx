import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { InteractiveBackground } from "@/components/ui/InteractiveBackground";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MathOML — The Interactive Digital Mathematics Laboratory",
  description:
    "Next-generation mathematics studio: live 3D surface shaders, interactive 2D curve tracing, multi-question photo OCR queue, and exact step-by-step computer algebra systems.",
  keywords: [
    "math solver", "3d graphing", "step by step calculus", "matrix algebra", "latex ocr", "interactive mathematics",
    "eigenvalues", "multivariate surface", "mathoml", "derivatives", "integrals"
  ],
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen selection:bg-emerald-500/30 selection:text-emerald-300`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <InteractiveBackground />
          <div className="relative z-10 flex min-h-screen flex-col">
            {children}
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
