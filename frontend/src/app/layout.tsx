import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { InteractiveBackground } from "@/components/ui/InteractiveBackground";

const geistSans = { variable: "--font-geist-sans" };
const geistMono = { variable: "--font-geist-mono" };

export const metadata: Metadata = {
  title: "MathOML — Mathematics, Data Analysis & Machine Learning",
  description:
    "Interactive math solvers, 2D and 3D graphing, automated exploratory data analysis, and machine learning workspaces.",
  keywords: [
    "math solver",
    "eda",
    "exploratory data analysis",
    "3d graphing",
    "calculus",
    "matrix algebra",
    "machine learning",
    "ocr",
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#fbfbfa] text-[#1d1d1f] min-h-screen selection:bg-[#0071e3]/15 selection:text-[#0071e3]`}>
        <InteractiveBackground />
        <div className="relative z-10 flex min-h-screen flex-col">
          {children}
        </div>
        <Toaster />
      </body>
    </html>
  );
}
