import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { AuthProvider } from "@/components/AuthProvider";
import { UserMenu } from "@/components/UserMenu";
import { NavLinks } from "@/components/NavLinks";

export const metadata: Metadata = {
  title: "MIT Free Food Events Hunter",
  description: "Find free food and interesting events across MIT campus",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <header className="sticky top-0 z-10 bg-cream/80 backdrop-blur-md border-b-2 border-cute-border">
            <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
              <Link href="/" className="flex items-center gap-2 group">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink to-purple text-white text-sm font-bold shadow-md transition-transform group-hover:scale-110 group-hover:rotate-3">
                  M
                </span>
                <span className="text-lg font-bold text-cute-text tracking-tight">
                  MIT Events
                </span>
              </Link>
              <div className="flex items-center gap-5 text-sm font-semibold">
                <NavLinks />
                <UserMenu />
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
