import { Suspense } from "react";
import { PricingClient } from "./PricingClient";

export const metadata = {
  title: "Pricing - MIT Events",
};

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-gray-400">Loading...</div>}>
      <PricingClient />
    </Suspense>
  );
}
