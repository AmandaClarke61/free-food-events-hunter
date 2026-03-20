"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";

export function NavLinks() {
  const { user } = useAuth();

  return (
    <>
      <Link
        href="/"
        className="text-gray-600 hover:text-gray-900 transition"
      >
        All Events
      </Link>
      <Link
        href="/free-food"
        className="text-green-700 hover:text-green-900 transition"
      >
        Free Food
      </Link>
      {user && (
        <Link
          href="/for-you"
          className="text-blue-700 hover:text-blue-900 transition"
        >
          For You
        </Link>
      )}
    </>
  );
}
