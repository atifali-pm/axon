import { db, schema } from "@axon/db";
import type { StripeWebhookData } from "@axon/shared/queues";
import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { logger } from "../lib/logger";

type StripeEvent = Stripe.Event;

function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set; cannot process webhook");
  return new Stripe(key, { typescript: true });
}

function planFromPriceId(priceId: string | null | undefined): "free" | "starter" | "pro" {
  if (!priceId) return "free";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  return "free";
}

async function onSubscriptionChange(sub: Stripe.Subscription) {
  const orgId = sub.metadata?.organizationId;
  if (!orgId) {
    logger.warn({ subId: sub.id }, "subscription missing organizationId metadata; skipping");
    return;
  }
  const firstItem = sub.items.data[0];
  const priceId = firstItem?.price?.id ?? null;
  const plan = sub.status === "active" || sub.status === "trialing"
    ? planFromPriceId(priceId)
    : "free";

  await db
    .update(schema.organizations)
    .set({ stripeSubscriptionId: sub.id, plan })
    .where(eq(schema.organizations.id, orgId));

  logger.info({ orgId, subId: sub.id, status: sub.status, plan }, "subscription synced");
}

async function onSubscriptionDeleted(sub: Stripe.Subscription) {
  const orgId = sub.metadata?.organizationId;
  if (!orgId) return;
  await db
    .update(schema.organizations)
    .set({ stripeSubscriptionId: null, plan: "free" })
    .where(eq(schema.organizations.id, orgId));
  logger.info({ orgId, subId: sub.id }, "subscription cancelled; downgraded to free");
}

async function onInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const subField = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null })
    .subscription;
  const subId = typeof subField === "string" ? subField : subField?.id;
  logger.warn(
    { customerId, subId, attempt: invoice.attempt_count, amountDue: invoice.amount_due },
    "invoice payment failed; Stripe will retry per dunning settings",
  );
  // Future: enqueue email.send to notify the org owner. For now just log.
}

export async function stripeWebhookProcessor(job: Job<StripeWebhookData>) {
  const { _meta, event } = job.data;
  const typed = event as StripeEvent;

  logger.info({ jobId: _meta.jobId, type: typed.type, eventId: typed.id }, "processing stripe event");

  switch (typed.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      await onSubscriptionChange(typed.data.object as Stripe.Subscription);
      break;
    }
    case "customer.subscription.deleted": {
      await onSubscriptionDeleted(typed.data.object as Stripe.Subscription);
      break;
    }
    case "invoice.payment_failed": {
      await onInvoicePaymentFailed(typed.data.object as Stripe.Invoice);
      break;
    }
    case "checkout.session.completed": {
      // Subscription events will arrive separately; log for audit.
      const session = typed.data.object as Stripe.Checkout.Session;
      logger.info({ sessionId: session.id, mode: session.mode }, "checkout completed");
      break;
    }
    default: {
      logger.info({ type: typed.type }, "stripe event ignored (no handler)");
    }
  }

  // Touch stripe() so we fail fast if STRIPE_SECRET_KEY got unset between
  // webhook receipt and worker processing (we don't make Stripe API calls
  // from the worker today, but future dunning/refund flows will).
  if (process.env.STRIPE_WORKER_PRECHECK === "1") void stripe();

  return { processed: typed.type };
}
