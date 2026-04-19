/**
 * Stripe billing.
 *
 *   POST /api/billing/checkout   body { plan } -> { url }
 *   POST /api/billing/portal                   -> { url }
 *   POST /webhooks/stripe                      Stripe signs this; we enqueue for async handling
 *
 * All mutating endpoints require owner role. Without STRIPE_SECRET_KEY set,
 * everything returns 503 billing_not_configured so the product degrades gracefully.
 */
import { db, schema } from "@axon/db";
import { QUEUE_NAMES } from "@axon/shared/queues";
import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth } from "../middleware/auth";
import { enqueue } from "../queues";
import { priceFor, stripe, stripeConfigured } from "../lib/stripe";

async function requireOwner(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (reply.sent) return;
  if (req.memberRole !== "owner") {
    return reply.code(403).send({ error: "owner_only" });
  }
}

export async function billingRoutes(app: FastifyInstance) {
  app.post<{ Body: { plan?: string } }>(
    "/checkout",
    { preHandler: requireOwner },
    async (req, reply) => {
      if (!stripe || !stripeConfigured()) {
        return reply.code(503).send({ error: "billing_not_configured" });
      }
      const plan = req.body?.plan;
      if (!plan || !priceFor[plan]) {
        return reply.code(400).send({ error: "unknown_plan", plan });
      }
      const priceId = priceFor[plan]!;

      // Reuse the org's Stripe customer if we've seen them before.
      let customerId = req.organization.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: req.user.email,
          name: req.organization.name,
          metadata: {
            organizationId: req.organization.id,
            userId: req.user.id,
          },
        });
        customerId = customer.id;
        await db
          .update(schema.organizations)
          .set({ stripeCustomerId: customerId })
          .where(eq(schema.organizations.id, req.organization.id));
      }

      const appUrl = process.env.APP_URL ?? "http://localhost:3100";
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/billing?checkout=success`,
        cancel_url: `${appUrl}/billing?checkout=cancelled`,
        allow_promotion_codes: true,
        subscription_data: {
          metadata: {
            organizationId: req.organization.id,
            plan,
          },
        },
      });
      return { url: session.url };
    },
  );

  app.post("/portal", { preHandler: requireOwner }, async (req, reply) => {
    if (!stripe || !stripeConfigured()) {
      return reply.code(503).send({ error: "billing_not_configured" });
    }
    const customerId = req.organization.stripeCustomerId;
    if (!customerId) {
      return reply.code(400).send({ error: "no_stripe_customer" });
    }
    const appUrl = process.env.APP_URL ?? "http://localhost:3100";
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/billing`,
    });
    return { url: portal.url };
  });

  app.get("/me", { preHandler: requireAuth }, async (req) => ({
    plan: req.organization.plan,
    hasStripeCustomer: !!req.organization.stripeCustomerId,
    billingConfigured: stripeConfigured(),
  }));
}

/**
 * Stripe webhook. Mounted at /webhooks/stripe on the root app (not under
 * the auth-protected /api prefix) because Stripe signs the request itself
 * with the webhook secret; no user session is involved.
 *
 * We verify the signature, then enqueue a stripe.webhook job with the event
 * payload. The worker does the actual DB mutation so the HTTP call returns
 * quickly and retries are handled by BullMQ.
 */
export async function stripeWebhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_req, body, done) => done(null, body),
  );

  app.post("/stripe", async (req, reply) => {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      return reply.code(503).send({ error: "billing_not_configured" });
    }
    const sig = req.headers["stripe-signature"];
    if (typeof sig !== "string") {
      return reply.code(400).send({ error: "missing_signature" });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      app.log.warn({ err }, "stripe webhook signature verification failed");
      return reply.code(400).send({ error: "bad_signature" });
    }

    // Pull orgId from subscription / customer metadata to route the job.
    const orgId =
      (event.data.object as { metadata?: Record<string, string> }).metadata
        ?.organizationId ?? "system";

    await enqueue(
      QUEUE_NAMES.stripeWebhook,
      event.type,
      { event: event as unknown },
      orgId,
    );

    return { received: true, type: event.type };
  });
}
