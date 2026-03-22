"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [step, setStep] = useState<"register" | "verify">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: name || undefined }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    setStep("verify");
    setLoading(false);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    await refresh();
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-sm pt-6">
      <div className="text-center">
        <div className="text-4xl mb-3">{step === "register" ? "\u{1F680}" : "\u{2709}\u{FE0F}"}</div>
        <h1 className="text-3xl font-bold text-cute-text">
          {step === "register" ? "Join us!" : "Check your email"}
        </h1>
        <p className="mt-2 text-sm text-cute-light font-semibold">
          {step === "register"
            ? "Register with your @mit.edu email"
            : `We sent a code to ${email}`}
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl bg-pink-light px-4 py-3 text-sm text-pink-dark font-semibold border-2 border-pink/20">
          {error}
        </div>
      )}

      {step === "register" ? (
        <form onSubmit={handleRegister} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-bold text-cute-text mb-1.5">
              Name (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-cute-text mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kerb@mit.edu"
              required
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-cute-text mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              className="input-field"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create account \u{2728}"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-bold text-cute-text mb-1.5">
              Verification code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              required
              maxLength={6}
              className="input-field text-center text-lg tracking-widest"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify \u{2705}"}
          </button>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-cute-light font-semibold">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-pink hover:text-pink-dark transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
