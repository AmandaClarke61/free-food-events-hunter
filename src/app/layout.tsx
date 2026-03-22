import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { AuthProvider } from "@/components/AuthProvider";
import { UserMenu } from "@/components/UserMenu";
import { NavLinks } from "@/components/NavLinks";
// import { ChatWidget } from "@/components/ChatWidget"; // Premium feature — hidden for now

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
      <body className="bg-gray-50 text-gray-900 antialiased">
        <AuthProvider>
          <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
            <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
              <Link href="/" className="text-lg font-bold text-gray-900">
                MIT Events
              </Link>
              <div className="flex items-center gap-4 text-sm font-medium">
                <NavLinks />
                <UserMenu />
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
          {/* <ChatWidget /> Premium feature — hidden for now */}
        </AuthProvider>
      </body>
    </html>
  );
}
