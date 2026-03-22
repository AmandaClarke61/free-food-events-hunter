import Stripe from "stripe";
import { prisma } from "./db";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export const PRICE_ID = process.env.STRIPE_PRICE_ID || "";

export async function getOrCreateCustomer(userId: string, email: string) {
  // Check if user already has a subscription with a payment ID (Stripe customer)
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (sub?.paymentId) {
    // paymentId stores "cus_xxx|sub_xxx"
    const cusId = sub.paymentId.split("|")[0];
    if (cusId.startsWith("cus_")) return cusId;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  return customer.id;
}

export async function createCheckoutSession(userId: string, email: string) {
  const customerId = await getOrCreateCustomer(userId, email);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pricing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pricing?canceled=true`,
    metadata: { userId },
    subscription_data: {
      trial_period_days: 14,
      metadata: { userId },
    },
  });

  return session;
}

export async function createPortalSession(userId: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub?.paymentId) throw new Error("No subscription found");

  const customerId = sub.paymentId.split("|")[0];

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pricing`,
  });

  return session;
}

export async function handleSubscriptionEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (!userId) break;

      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          plan: "pro",
          status: "active",
          paymentId: `${customerId}|${subscriptionId}`,
        },
        update: {
          plan: "pro",
          status: "active",
          paymentId: `${customerId}|${subscriptionId}`,
        },
      });
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      if (!userId) break;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub = subscription as any;
      const status = sub.status === "active" || sub.status === "trialing"
        ? "active"
        : sub.status === "canceled"
          ? "cancelled"
          : "expired";

      await prisma.subscription.update({
        where: { userId },
        data: {
          status,
          endDate: sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : null,
        },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      if (!userId) break;

      await prisma.subscription.update({
        where: { userId },
        data: { status: "expired", plan: "free" },
      });
      break;
    }
  }
}

export async function isProUser(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  return sub?.plan === "pro" && sub?.status === "active";
}
