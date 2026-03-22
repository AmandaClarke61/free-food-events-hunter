"use client";

import { useAuth } from "./AuthProvider";
import Link from "next/link";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="py-16 text-center text-gray-400">Loading...</div>
    );
  }

  if (!user) {
    return <LandingHero />;
  }

  return <>{children}</>;
}

function LandingHero() {
  return (
    <div className="py-8">
      {/* Hero */}
      <div className="text-center mb-10">
        <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
          Never Miss Free Food on Campus
        </h2>
        <p className="mt-3 text-lg text-gray-500 max-w-xl mx-auto">
          We aggregate events from 8+ MIT sources and automatically detect which ones have free food. Sign in with your @mit.edu email to get started.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition"
          >
            Sign In
          </Link>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 mb-3">
            <span className="text-xl">&#127829;</span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Free Food Detection</h3>
          <p className="text-sm text-gray-500">
            AI-powered detection of events with free food, from pizza seminars to catered receptions.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 mb-3">
            <span className="text-xl">&#128218;</span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">8 Sources Aggregated</h3>
          <p className="text-sm text-gray-500">
            Events from MIT Calendar, Engage, Sloan, CSAIL, Media Lab, GSC, IDSS, and BCS in one place.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 mb-3">
            <span className="text-xl">&#11088;</span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Personalized For You</h3>
          <p className="text-sm text-gray-500">
            Set your interests, bookmark events, and get personalized recommendations.
          </p>
        </div>
      </div>

      {/* Social proof */}
      <div className="text-center text-sm text-gray-400">
        Built for the MIT community &middot; @mit.edu email required
      </div>
    </div>
  );
}
