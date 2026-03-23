"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/");
    }
  }

  return (
    <div className="mx-auto max-w-sm pt-6">
      <div className="text-center">
        <div className="text-4xl mb-3">&#128075;</div>
        <h1 className="text-3xl font-bold text-cute-text">Welcome back!</h1>
        <p className="mt-2 text-sm text-cute-light font-semibold">
          Sign in with your @mit.edu email
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {error && (
          <div className="rounded-2xl bg-pink-light px-4 py-3 text-sm text-pink-dark font-semibold border-2 border-pink/20">
            {error}
          </div>
        )}

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
            required
            className="input-field"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in ✨"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-cute-light font-semibold">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-bold text-pink hover:text-pink-dark transition-colors">
          Register
        </Link>
      </p>
    </div>
  );
}
