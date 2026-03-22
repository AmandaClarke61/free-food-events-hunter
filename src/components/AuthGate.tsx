"use client";

import { useAuth } from "./AuthProvider";
import Link from "next/link";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="py-16 text-center text-cute-muted">Loading...</div>
    );
  }

  if (!user) {
    return <LandingHero />;
  }

  return <>{children}</>;
}

function LandingHero() {
  return (
    <div className="-mx-4 -mt-8">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-12 pb-16">
        {/* Decorative blobs */}
        <div className="blob-pink animate-blob top-10 -left-20" />
        <div className="blob-purple animate-blob top-40 right-0" style={{ animationDelay: "2s" }} />
        <div className="blob-mint animate-blob bottom-10 left-1/3" style={{ animationDelay: "4s" }} />

        <div className="relative z-10 text-center max-w-lg mx-auto">
          {/* Floating food emojis */}
          <div className="flex justify-center gap-4 mb-6">
            <span className="text-4xl animate-float" style={{ animationDelay: "0s" }}>&#127829;</span>
            <span className="text-4xl animate-float" style={{ animationDelay: "0.5s" }}>&#127838;</span>
            <span className="text-4xl animate-float" style={{ animationDelay: "1s" }}>&#127849;</span>
            <span className="text-4xl animate-float" style={{ animationDelay: "1.5s" }}>&#129385;</span>
            <span className="text-4xl animate-float" style={{ animationDelay: "2s" }}>&#127836;</span>
          </div>

          <div className="animate-fade-in-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-mint-light px-4 py-2 text-xs font-bold text-mint uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
              </span>
              Live from 8 MIT sources
            </span>
          </div>

          <h2 className="mt-6 text-4xl sm:text-5xl font-bold text-cute-text leading-tight animate-fade-in-up delay-100">
            Never Miss{" "}
            <span className="relative inline-block">
              <span className="relative z-10">Free Food</span>
              <span className="absolute bottom-1 left-0 right-0 h-3 bg-yellow-light rounded-full -z-0" />
            </span>{" "}
            on Campus!
          </h2>

          <p className="mt-5 text-base text-cute-light leading-relaxed animate-fade-in-up delay-200">
            We scan every MIT event calendar and use AI to spot free food.
            Pizza talks, catered seminars, snack socials — all in one place!
          </p>

          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3 animate-fade-in-up delay-300">
            <Link href="/register" className="btn-primary text-base px-10 py-4">
              Get Started Free &#10024;
            </Link>
            <Link href="/login" className="btn-secondary text-base px-10 py-4">
              I Have an Account
            </Link>
          </div>

          <p className="mt-5 text-xs text-cute-muted animate-fade-in-up delay-400">
            &#127891; MIT email required &middot; 100% free &middot; Takes 30 seconds
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="px-4 py-8">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-3">
          <div className="card p-4 text-center animate-bounce-in delay-400">
            <div className="text-2xl font-bold text-purple">8+</div>
            <div className="mt-1 text-xs font-semibold text-cute-muted uppercase tracking-wide">Sources</div>
          </div>
          <div className="card p-4 text-center animate-bounce-in delay-500">
            <div className="text-2xl font-bold text-pink">100+</div>
            <div className="mt-1 text-xs font-semibold text-cute-muted uppercase tracking-wide">Events/wk</div>
          </div>
          <div className="card p-4 text-center animate-bounce-in delay-600">
            <div className="text-2xl font-bold text-mint">AI</div>
            <div className="mt-1 text-xs font-semibold text-cute-muted uppercase tracking-wide">Powered</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-8">
        <div className="max-w-2xl mx-auto grid sm:grid-cols-3 gap-4">
          <div className="card p-6 animate-fade-in-up delay-400 group">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-light mb-4 group-hover:animate-wiggle">
              <span className="text-2xl">&#127829;</span>
            </div>
            <h3 className="font-bold text-cute-text text-base mb-1.5">Free Food Detection</h3>
            <p className="text-sm text-cute-light leading-relaxed">
              AI scans every event for pizza, snacks, catering — you never miss a free bite!
            </p>
          </div>

          <div className="card p-6 animate-fade-in-up delay-500 group">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-light mb-4 group-hover:animate-wiggle">
              <span className="text-2xl">&#128218;</span>
            </div>
            <h3 className="font-bold text-cute-text text-base mb-1.5">8 Sources, One Feed</h3>
            <p className="text-sm text-cute-light leading-relaxed">
              MIT Calendar, Engage, Sloan, CSAIL, Media Lab, GSC, IDSS & BCS.
            </p>
          </div>

          <div className="card p-6 animate-fade-in-up delay-600 group">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-light mb-4 group-hover:animate-wiggle">
              <span className="text-2xl">&#11088;</span>
            </div>
            <h3 className="font-bold text-cute-text text-base mb-1.5">Personalized</h3>
            <p className="text-sm text-cute-light leading-relaxed">
              Pick your interests, bookmark favorites, and get smart recommendations.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <section className="px-4 pb-12">
        <div className="text-center animate-fade-in-up delay-700">
          <p className="text-sm text-cute-muted font-semibold">
            Made with &#10084;&#65039; for the MIT community
          </p>
        </div>
      </section>
    </div>
  );
}
