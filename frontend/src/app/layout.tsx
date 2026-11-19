import type { Metadata } from "next";
import { Inter, Newsreader, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { UploadProvider } from "@/context/UploadContext";
import { AppShell } from "@/components/layout/AppShell";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  style: ["normal", "italic"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Docora — Your documents. Your intelligence.",
  description:
    "An AI-powered workspace to understand documents, discover insights, conduct research and create knowledge.",
  applicationName: "Docora",
  keywords: [
    "Docora",
    "document intelligence",
    "AI research workspace",
    "NotebookLM alternative",
    "RAG",
    "document chat",
    "mind maps",
    "audio overviews",
  ],
  authors: [{ name: "Docora Team" }],
  creator: "Docora",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ),
  openGraph: {
    title: "Docora — Your documents. Your intelligence.",
    description:
      "Turn your documents into knowledge with AI-powered research, intelligent answers and creative tools.",
    siteName: "Docora",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/brand/docora-logo.svg",
        width: 1200,
        height: 630,
        alt: "Docora — Your documents. Your intelligence.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Docora — Your documents. Your intelligence.",
    description:
      "Turn your documents into knowledge with AI-powered research, intelligent answers and creative tools.",
    images: ["/brand/docora-logo.svg"],
    creator: "@docora",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/docora-icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-canvas text-ink font-sans antialiased flex">
        <AuthProvider>
          <UploadProvider>
            <AppShell>{children}</AppShell>
          </UploadProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
