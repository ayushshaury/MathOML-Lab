import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { InteractiveBackground } from "@/components/ui/InteractiveBackground";

const geistSans = { variable: "--font-geist-sans" };
const geistMono = { variable: "--font-geist-mono" };

export const metadata: Metadata = {
  title: "MathOML — The Interactive Digital Mathematics Laboratory",
  description:
    "Next-generation mathematics studio: live 3D surface shaders, interactive 2D curve tracing, multi-question photo OCR queue, and exact step-by-step computer algebra systems.",
  keywords: [
    "math solver", "3d graphing", "step by step calculus", "matrix algebra", "latex ocr", "interactive mathematics",
    "eigenvalues", "multivariate surface", "mathoml", "derivatives", "integrals"
  ],
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen selection:bg-emerald-500/20 selection:text-emerald-700`}>
        <InteractiveBackground />
        <div className="relative z-10 flex min-h-screen flex-col">
          {children}
        </div>
        <Toaster />
      </body>
    </html>
  );
}
