"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

export default function WhatsAppSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [binding, setBinding] = useState<{ phoneNumber: string; verified: boolean } | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      fetch("/api/whatsapp/bind")
        .then((r) => r.json())
        .then((d) => setBinding(d.binding))
        .finally(() => setLoading(false));
    }
  }, [user, authLoading, router]);

  const handleBind = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) return;
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/whatsapp/bind", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: phoneInput.trim() }),
    });

    const data = await res.json();
    setSaving(false);

    if (res.ok) {
      setBinding({ phoneNumber: data.phoneNumber, verified: true });
      setMessage("WhatsApp linked successfully! Check your WhatsApp for a welcome message.");
    } else {
      setMessage(data.error || "Failed to link");
    }
  };

  const handleUnbind = async () => {
    setSaving(true);
    await fetch("/api/whatsapp/bind", { method: "DELETE" });
    setBinding(null);
    setSaving(false);
    setMessage("WhatsApp unlinked.");
  };

  const isPro = (user as { plan?: string })?.plan === "pro";

  if (authLoading || loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  if (!isPro) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">WhatsApp Integration</h1>
        <p className="text-sm text-gray-500 mb-6">
          WhatsApp integration is available for Pro subscribers.
        </p>
        <a
          href="/pricing"
          className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          Upgrade to Pro
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">WhatsApp Settings</h1>
      <p className="text-sm text-gray-500 mb-6">
        Link your WhatsApp to get event reminders and manage your schedule via chat.
      </p>

      {binding ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Connected</p>
              <p className="text-sm text-gray-500">+{binding.phoneNumber}</p>
            </div>
          </div>
          <button
            onClick={handleUnbind}
            disabled={saving}
            className="mt-4 w-full rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition"
          >
            Unlink WhatsApp
          </button>
        </div>
      ) : (
        <form onSubmit={handleBind} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="+1 234 567 8900"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Include country code (e.g., +1 for US)
            </p>
          </div>
          <button
            type="submit"
            disabled={saving || !phoneInput.trim()}
            className="w-full rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 transition disabled:opacity-50"
          >
            {saving ? "Linking..." : "Link WhatsApp"}
          </button>
        </form>
      )}

      {message && (
        <p className="mt-4 text-sm text-center text-gray-600">{message}</p>
      )}

      <div className="mt-8 rounded-lg bg-blue-50 border border-blue-100 p-4">
        <h3 className="font-medium text-blue-900 text-sm">What you can do via WhatsApp:</h3>
        <ul className="mt-2 space-y-1 text-sm text-blue-800">
          <li>&quot;What free food events are tomorrow?&quot;</li>
          <li>&quot;Add meeting with advisor at 2pm&quot;</li>
          <li>&quot;Show my schedule for today&quot;</li>
          <li>&quot;Remind me about the pizza seminar&quot;</li>
        </ul>
      </div>
    </div>
  );
}
