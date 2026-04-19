import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
// Let the SDK pick its pinned apiVersion so upgrading the stripe package
// doesn't require a literal-type update here.
export const stripe = key ? new Stripe(key, { typescript: true }) : null;

export const priceFor: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
};

export function stripeConfigured(): boolean {
  return stripe !== null && !!process.env.STRIPE_WEBHOOK_SECRET;
}
