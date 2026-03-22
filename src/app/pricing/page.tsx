"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";

interface SubInfo {
  plan: string;
  status: string;
  startDate?: string;
  endDate?: string;
}

export default function PricingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sub, setSub] = useState<SubInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  useEffect(() => {
    if (user) {
      fetch("/api/subscription")
        .then((r) => r.json())
        .then((d) => setSub(d.subscription))
        .finally(() => setLoading(false));
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const handleUpgrade = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    setCheckoutLoading(true);
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
    setCheckoutLoading(false);
  };

  const handleManage = async () => {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
  };

  const isPro = sub?.plan === "pro" && sub?.status === "active";

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
        Upgrade Your Experience
      </h1>
      <p className="text-center text-gray-500 mb-8">
        Free event browsing for everyone. Pro AI assistant for power users.
      </p>

      {success && (
        <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4 text-center">
          <p className="text-green-800 font-medium">Welcome to Pro! Your AI assistant is now active.</p>
        </div>
      )}

      {canceled && (
        <div className="mb-6 rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-center">
          <p className="text-yellow-800">Checkout canceled. No charges were made.</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Free Plan */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-bold text-gray-900">Free</h2>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            $0<span className="text-sm font-normal text-gray-500">/month</span>
          </p>
          <ul className="mt-6 space-y-3 text-sm text-gray-600">
            <li className="flex gap-2">
              <span className="text-green-500">&#10003;</span> Browse all campus events
            </li>
            <li className="flex gap-2">
              <span className="text-green-500">&#10003;</span> Free food detection
            </li>
            <li className="flex gap-2">
              <span className="text-green-500">&#10003;</span> Personalized recommendations
            </li>
            <li className="flex gap-2">
              <span className="text-green-500">&#10003;</span> Bookmark events
            </li>
            <li className="flex gap-2">
              <span className="text-green-500">&#10003;</span> Basic calendar
            </li>
          </ul>
          {!isPro && (
            <div className="mt-6">
              <span className="block w-full rounded-md border border-gray-300 bg-gray-50 px-4 py-2 text-center text-sm font-medium text-gray-500">
                Current Plan
              </span>
            </div>
          )}
        </div>

        {/* Pro Plan */}
        <div className="rounded-xl border-2 border-blue-500 bg-white p-6 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">
              POPULAR
            </span>
          </div>
          <h2 className="text-lg font-bold text-gray-900">Pro</h2>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            $4.99<span className="text-sm font-normal text-gray-500">/month</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">14-day free trial</p>
          <ul className="mt-6 space-y-3 text-sm text-gray-600">
            <li className="flex gap-2">
              <span className="text-green-500">&#10003;</span> Everything in Free
            </li>
            <li className="flex gap-2">
              <span className="text-blue-500">&#9733;</span> AI Schedule Assistant
            </li>
            <li className="flex gap-2">
              <span className="text-blue-500">&#9733;</span> WhatsApp integration
            </li>
            <li className="flex gap-2">
              <span className="text-blue-500">&#9733;</span> Smart reminders
            </li>
            <li className="flex gap-2">
              <span className="text-blue-500">&#9733;</span> Daily schedule summary
            </li>
            <li className="flex gap-2">
              <span className="text-blue-500">&#9733;</span> Time conflict detection
            </li>
          </ul>
          <div className="mt-6">
            {isPro ? (
              <button
                onClick={handleManage}
                className="block w-full rounded-md border border-blue-300 bg-blue-50 px-4 py-2 text-center text-sm font-medium text-blue-700 hover:bg-blue-100 transition"
              >
                Manage Subscription
              </button>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={checkoutLoading || loading}
                className="block w-full rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50"
              >
                {checkoutLoading ? "Loading..." : "Start Free Trial"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
