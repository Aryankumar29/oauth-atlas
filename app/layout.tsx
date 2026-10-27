import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

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
  title: "OAuth Atlas — OAuth setup and approval guides",
  description:
    "Decision-grade OAuth setup and approval guides for developers building AI agents.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900">
        <header className="border-b border-zinc-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white">
                OA
              </span>
              <span className="text-sm font-semibold tracking-tight">
                OAuth Atlas
              </span>
            </Link>

            <nav className="flex items-center gap-5 text-sm text-zinc-600">
              <Link href="/apps" className="hover:text-zinc-950">
                Library
              </Link>
              <Link href="/generate" className="hover:text-zinc-950">
                Generate
              </Link>
              <Link href="/evidence" className="hover:text-zinc-950">
                Evidence
              </Link>
            </nav>
          </div>
        </header>

        {children}

        <footer className="border-t border-zinc-200 bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <p>OAuth Atlas — decision-grade guides, with sources.</p>
            <p>
              Built by Aryan Kumar ·{" "}
              <a href="https://github.com/Aryankumar29/oauth-atlas" className="underline underline-offset-2 hover:text-zinc-900">
                Source on GitHub
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
