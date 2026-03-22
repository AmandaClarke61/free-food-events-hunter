"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";

export function UserMenu() {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (loading) return null;

  if (!user) {
    return (
      <Link
        href="/login"
        className="text-sm font-bold text-cute-light hover:text-pink transition-colors"
      >
        Sign in
      </Link>
    );
  }

  const initial = user.email[0].toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink to-purple text-sm font-bold text-white shadow-md hover:scale-110 hover:rotate-3 transition-all duration-300"
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 card py-2 z-50 animate-slide-down">
          <div className="border-b-2 border-cute-border px-4 py-3">
            <p className="text-sm font-bold text-cute-text truncate">
              {user.email}
            </p>
          </div>
          <Link
            href="/bookmarks"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm font-semibold text-cute-light hover:bg-pink-light hover:text-pink rounded-lg mx-1 transition-all"
          >
            &#10084;&#65039; My Bookmarks
          </Link>
          <button
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="block w-full text-left px-4 py-2.5 text-sm font-semibold text-cute-light hover:bg-cream-dark rounded-lg mx-1 transition-all"
          >
            &#128075; Sign out
          </button>
        </div>
      )}
    </div>
  );
}
