"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

export function NavLinks() {
  const { user } = useAuth();
  const pathname = usePathname();

  const linkClass = (href: string, color: string, activeColor: string) =>
    `relative rounded-full px-3.5 py-1.5 transition-all duration-300 ${
      pathname === href
        ? `${activeColor} font-bold scale-105`
        : `text-cute-light hover:${color} hover:scale-105`
    }`;

  return (
    <>
      <Link href="/" className={linkClass("/", "text-purple", "bg-purple-light text-purple")}>
        All
      </Link>
      <Link href="/free-food" className={linkClass("/free-food", "text-mint", "bg-mint-light text-mint")}>
        Free Food
      </Link>
      {user && (
        <Link href="/for-you" className={linkClass("/for-you", "text-pink", "bg-pink-light text-pink")}>
          For You
        </Link>
      )}
    </>
  );
}
