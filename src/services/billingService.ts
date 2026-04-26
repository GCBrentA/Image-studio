import { CreditLedgerReason, Prisma, SubscriptionStatus } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../utils/prisma";
import { HttpError } from "../utils/httpError";
import { addCredits, resetMonthlyCredits } from "./creditService";
import {
  getCreditPackByKey,
  getPlanByKey,
  getPlanByPriceId
} from "./billingCatalog";
import { ensureBillingReady, ensureCreditBillingReady, getStripe } from "./stripeService";
import type { StripeWebhookEvent } from "./stripeService";

type StripeCustomerRef = string | { id: string } | null;

type StripeSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

type StripeSubscriptionLike = {
  id: string;
  customer: StripeCustomerRef;
  metadata: Record<string, string>;
  status: StripeSubscriptionStatus;
  cancel_at_period_end: boolean;
  current_period_start?: number;
  current_period_end?: number;
  items: {
    data: Array<{
      current_period_end?: number;
      price: {
        id: string;
        product?: string | { id: string } | null;
      };
    }>;
  };
};

type StripeCheckoutSessionLike = {
  id: string;
  mode: "payment" | "setup" | "subscription" | null;
  customer: StripeCustomerRef;
  subscription?: string | { id: string } | null;
  payment_intent?: string | { id: string } | null;
  payment_status?: "paid" | "unpaid" | "no_payment_required" | null;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
  customer_details?: {
    email?: string | null;
  } | null;
};

type StripeCustomerLike = {
  id: string;
  email?: string | null;
  metadata?: Record<string, string> | null;
};

type StripeInvoiceLike = {
  id: string;
  billing_reason: string | null;
  subscription?: string | StripeSubscriptionLike | null;
  parent?: {
    subscription_details?: {
      subscription?: string | StripeSubscriptionLike | null;
    } | null;
  } | null;
};

type CheckoutSessionInput = {
  type: "subscription" | "credit_pack";
  plan?: string;
  pack?: string;
};

type CheckoutSessionResult = {
  id: string;
  url: string;
};

type PortalSessionResult = {
  url: string;
};

type CreditCheckoutSessionInput = {
  pack?: string;
};

const appUrl = (): string => env.appUrl || env.apiBaseUrl || `http://localhost:${env.port}`;
const appBaseUrl = (): string => appUrl().replace(/\/$/, "");
const successUrl = (): string => `${appBaseUrl()}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
const cancelUrl = (): string => `${appBaseUrl()}/billing/cancel`;
const creditSuccessUrl = (): string => `${appBaseUrl()}/billing/credits/success?session_id={CHECKOUT_SESSION_ID}`;
const creditCancelUrl = (): string => `${appBaseUrl()}/account/billing`;

const isKnownPrismaError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError;

const stripeStatusToSubscriptionStatus = (status: StripeSubscriptionStatus): SubscriptionStatus => {
  switch (status) {
    case "active":
      return SubscriptionStatus.active;
    case "trialing":
      return SubscriptionStatus.trialing;
    case "past_due":
      return SubscriptionStatus.past_due;
    case "canceled":
      return SubscriptionStatus.canceled;
    case "unpaid":
      return SubscriptionStatus.unpaid;
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return SubscriptionStatus.incomplete;
  }
};

const getCustomerId = async (userId: string): Promise<string> => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId
    },
    select: {
      id: true,
      email: true,
      stripe_customer_id: true
    }
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  if (user.stripe_customer_id) {
    return user.stripe_customer_id;
  }

  const customer = await getStripe().customers.create({
    email: user.email,
    metadata: {
      userId: user.id
    }
  });

  await prisma.user.update({
    where: {
      id: user.id
    },
    data: {
      stripe_customer_id: customer.id
    }
  });

  return customer.id;
};

const findExistingCustomerId = async (userId: string): Promise<string | null> => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId
    },
    select: {
      stripe_customer_id: true
    }
  });

  return user?.stripe_customer_id ?? null;
};

export const createCheckoutSession = async (
  userId: string,
  input: CheckoutSessionInput
): Promise<CheckoutSessionResult> => {
  if (input.type === "subscription") {
    await ensureBillingReady();
    const customerId = await getCustomerId(userId);
    const site = await prisma.connectedSite.findFirst({
      where: {
        user_id: userId
      },
      orderBy: {
        created_at: "asc"
      },
      select: {
        domain: true
      }
    });
    const plan = getPlanByKey(input.plan ?? "");
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: plan.priceId,
          quantity: 1
        }
      ],
      success_url: successUrl(),
      cancel_url: cancelUrl(),
      allow_promotion_codes: true,
      metadata: {
        account_id: userId,
        user_id: userId,
        userId,
        checkoutType: "subscription",
        plan: plan.plan,
        ...(site?.domain ? { store_domain: site.domain } : {})
      },
      subscription_data: {
        metadata: {
          account_id: userId,
          user_id: userId,
          userId,
          plan: plan.plan,
          ...(site?.domain ? { store_domain: site.domain } : {})
        }
      }
    });

    if (!session.url) {
      throw new HttpError(502, "Stripe did not return a checkout URL");
    }

    return {
      id: session.id,
      url: session.url
    };
  }

  if (input.type === "credit_pack") {
    return createCreditCheckoutSession(userId, {
      pack: input.pack
    });
  }

  throw new HttpError(400, "Invalid checkout session type");
};

export const createCreditCheckoutSession = async (
  userId: string,
  input: CreditCheckoutSessionInput
): Promise<CheckoutSessionResult> => {
  await ensureCreditBillingReady();
  const customerId = await getCustomerId(userId);
  const pack = getCreditPackByKey(input.pack ?? "");
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        price: pack.priceId,
        quantity: 1
      }
    ],
    success_url: creditSuccessUrl(),
    cancel_url: creditCancelUrl(),
    metadata: {
      account_id: userId,
      user_id: userId,
      userId,
      type: "credit_purchase",
      checkoutType: "credit_purchase",
      credit_pack: pack.key,
      pack: pack.key,
      credits: String(pack.credits)
    }
  });

  if (!session.url) {
    throw new HttpError(502, "Stripe did not return a checkout URL");
  }

  return {
    id: session.id,
    url: session.url
  };
};

export const createCustomerPortalSession = async (userId: string): Promise<PortalSessionResult> => {
  await ensureBillingReady();
  const customerId = await findExistingCustomerId(userId);

  if (!customerId) {
    throw new HttpError(404, "No Stripe customer exists for this account yet");
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appBaseUrl()}/account/billing`
  });

  return {
    url: session.url
  };
};

const getCustomerIdFromStripeObject = (customer: StripeCustomerRef): string | null => {
  if (!customer) {
    return null;
  }

  return typeof customer === "string" ? customer : customer.id;
};

const findUserByCustomerId = async (customerId: string) =>
  prisma.user.findUnique({
    where: {
      stripe_customer_id: customerId
    },
    select: {
      id: true
    }
  });

const getProductIdFromPrice = (price: StripeSubscriptionLike["items"]["data"][number]["price"] | undefined): string | null => {
  const product = price?.product;

  if (!product) {
    return null;
  }

  return typeof product === "string" ? product : product.id;
};

const upsertSubscriptionFromStripe = async (
  subscription: StripeSubscriptionLike,
  fallbackUserId?: string,
  billingEmail?: string | null
): Promise<void> => {
  const priceId = subscription.items.data[0]?.price.id ?? "";
  const stripeProductId = getProductIdFromPrice(subscription.items.data[0]?.price);
  const plan = getPlanByPriceId(priceId);

  if (!plan) {
    return;
  }

  const customerId = getCustomerIdFromStripeObject(subscription.customer);
  const user =
    customerId ? await findUserByCustomerId(customerId) : null;
  const userId = user?.id ?? fallbackUserId ?? subscription.metadata.userId;

  if (!userId) {
    return;
  }

  if (customerId) {
    await prisma.user.update({
      where: {
        id: userId
      },
      data: {
        stripe_customer_id: customerId
      }
    });
  }

  const currentPeriodStartSeconds = subscription.current_period_start;
  const currentPeriodEndSeconds = subscription.current_period_end ?? subscription.items.data[0]?.current_period_end;
  const currentPeriodStart = currentPeriodStartSeconds ? new Date(currentPeriodStartSeconds * 1000) : null;
  const currentPeriodEnd = new Date((currentPeriodEndSeconds ?? Math.floor(Date.now() / 1000)) * 1000);

  await prisma.subscription.upsert({
    where: {
      stripe_subscription_id: subscription.id
    },
    update: {
      user_id: userId,
      plan: plan.plan,
      status: stripeStatusToSubscriptionStatus(subscription.status),
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      stripe_price_id: priceId,
      stripe_product_id: stripeProductId,
      cancel_at_period_end: subscription.cancel_at_period_end,
      credits_included: plan.credits,
      billing_email: billingEmail ?? undefined,
      credits_reset_at: currentPeriodEnd
    },
    create: {
      user_id: userId,
      plan: plan.plan,
      status: stripeStatusToSubscriptionStatus(subscription.status),
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      stripe_product_id: stripeProductId,
      cancel_at_period_end: subscription.cancel_at_period_end,
      credits_included: plan.credits,
      billing_email: billingEmail ?? undefined,
      credits_reset_at: currentPeriodEnd
    }
  });

  await prisma.user.update({
    where: {
      id: userId
    },
    data: {
      stripe_customer_id: customerId ?? undefined,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      stripe_product_id: stripeProductId,
      billing_plan: plan.plan,
      billing_status: stripeStatusToSubscriptionStatus(subscription.status),
      billing_email: billingEmail ?? undefined,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
      credits_included: plan.credits,
      credits_reset_at: currentPeriodEnd
    }
  });
};

const handleCheckoutSessionCompleted = async (
  session: StripeCheckoutSessionLike,
  stripeEventId?: string
): Promise<void> => {
  const customerId = getCustomerIdFromStripeObject(session.customer);
  const userId = session.metadata?.userId ?? session.metadata?.user_id ?? session.metadata?.account_id;
  const billingEmail = session.customer_details?.email ?? null;
  const checkoutType = session.metadata?.type ?? session.metadata?.checkoutType;

  if (customerId && userId) {
    await prisma.user.update({
      where: {
        id: userId
      },
      data: {
        stripe_customer_id: customerId,
        billing_email: billingEmail ?? undefined
      }
    });
  }

  if (checkoutType === "credit_purchase") {
    if (session.mode !== "payment" || session.payment_status !== "paid" || !userId) {
      return;
    }

    const packKey = session.metadata?.credit_pack ?? session.metadata?.pack;
    const pack = packKey ? getCreditPackByKey(packKey) : null;
    const metadataCredits = Number(session.metadata?.credits ?? 0);

    if (!pack || metadataCredits !== pack.credits) {
      throw new Error("Stripe credit purchase metadata does not match server credit pack config");
    }

    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

    await addCredits(userId, pack.credits, CreditLedgerReason.purchase, {
      idempotencyKey: `stripe-checkout:${session.id}:credits`,
      source: "stripe_credit_purchase",
      description: `${pack.displayName} purchased`,
      stripeEventId: stripeEventId ?? session.id
    });

    console.info("Stripe credit purchase processed", {
      accountId: userId,
      creditPack: pack.key,
      credits: pack.credits,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId ?? null,
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null
    });

    return;
  }

  if (session.mode === "subscription" && session.subscription) {
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription.id;
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId) as unknown as StripeSubscriptionLike;
    await upsertSubscriptionFromStripe(subscription, userId, billingEmail);
    return;
  }

};

const handleSubscriptionDeleted = async (subscription: StripeSubscriptionLike): Promise<void> => {
  await prisma.subscription.updateMany({
    where: {
      stripe_subscription_id: subscription.id
    },
    data: {
      status: SubscriptionStatus.canceled,
      cancel_at_period_end: false
    }
  });

  await prisma.user.updateMany({
    where: {
      stripe_subscription_id: subscription.id
    },
    data: {
      billing_status: SubscriptionStatus.canceled,
      cancel_at_period_end: false
    }
  });
};

const getInvoiceSubscriptionId = (invoice: StripeInvoiceLike): string | null => {
  const subscription = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;

  if (!subscription) {
    return null;
  }

  return typeof subscription === "string" ? subscription : subscription.id;
};

const handleInvoicePaid = async (invoice: StripeInvoiceLike): Promise<void> => {
  const subscriptionId = getInvoiceSubscriptionId(invoice);

  if (
    !subscriptionId ||
    !["subscription_create", "subscription_cycle"].includes(invoice.billing_reason ?? "")
  ) {
    return;
  }

  const subscription = await getStripe().subscriptions.retrieve(subscriptionId) as unknown as StripeSubscriptionLike;
  await upsertSubscriptionFromStripe(subscription);

  const localSubscription = await prisma.subscription.findUnique({
    where: {
      stripe_subscription_id: subscription.id
    },
    select: {
      user_id: true,
      plan: true
    }
  });

  if (!localSubscription) {
    return;
  }

  const credits = await resetMonthlyCredits(localSubscription.user_id, localSubscription.plan, {
    idempotencyKey: `stripe-invoice:${invoice.id}:monthly-reset`,
    source: "stripe_invoice_payment_succeeded",
    description: "Monthly subscription credits reset",
    stripeEventId: invoice.id,
    creditsResetAt: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : undefined
  });

  await prisma.subscription.update({
    where: {
      stripe_subscription_id: subscription.id
    },
    data: {
      credits_reset_at: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : undefined,
      credits_included: credits.credits_total,
      credits_remaining: credits.credits_remaining,
      credits_used: Math.max(credits.credits_total - credits.credits_remaining, 0)
    }
  });
};

const handleCustomerUpdated = async (customer: StripeCustomerLike): Promise<void> => {
  if (!customer.id) {
    return;
  }

  await prisma.user.updateMany({
    where: {
      stripe_customer_id: customer.id
    },
    data: {
      billing_email: customer.email ?? undefined
    }
  });
};

const handleInvoicePaymentFailed = async (invoice: StripeInvoiceLike): Promise<void> => {
  const subscriptionId = getInvoiceSubscriptionId(invoice);

  if (!subscriptionId) {
    return;
  }

  await prisma.subscription.updateMany({
    where: {
      stripe_subscription_id: subscriptionId
    },
    data: {
      status: SubscriptionStatus.past_due
    }
  });

  await prisma.user.updateMany({
    where: {
      stripe_subscription_id: subscriptionId
    },
    data: {
      billing_status: SubscriptionStatus.past_due
    }
  });
};

export const processStripeEvent = async (event: StripeWebhookEvent): Promise<"processed" | "duplicate" | "ignored"> => {
  try {
    await prisma.stripeEvent.create({
      data: {
        stripe_event_id: event.id,
        event_type: event.type,
        type: event.type,
        raw_event: event as Prisma.InputJsonValue,
        account_id: event.data.object && typeof event.data.object === "object" && "metadata" in event.data.object
          ? ((event.data.object as { metadata?: Record<string, string> | null }).metadata?.account_id ??
            (event.data.object as { metadata?: Record<string, string> | null }).metadata?.user_id ??
            (event.data.object as { metadata?: Record<string, string> | null }).metadata?.userId)
          : undefined,
        status: "processing"
      }
    });
  } catch (error) {
    if (isKnownPrismaError(error) && error.code === "P2002") {
      return "duplicate";
    } else {
      throw error;
    }
  }

  let result: "processed" | "ignored";

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as StripeCheckoutSessionLike, event.id);
        result = "processed";
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await upsertSubscriptionFromStripe(event.data.object as StripeSubscriptionLike);
        result = "processed";
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as StripeSubscriptionLike);
        result = "processed";
        break;
      case "invoice.paid":
      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object as StripeInvoiceLike);
        result = "processed";
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as StripeInvoiceLike);
        result = "processed";
        break;
      case "customer.updated":
        await handleCustomerUpdated(event.data.object as StripeCustomerLike);
        result = "processed";
        break;
      default:
        result = "ignored";
    }

    await prisma.stripeEvent.update({
      where: {
        stripe_event_id: event.id
      },
      data: {
        processed_at: new Date(),
        status: result
      }
    });
  } catch (error) {
    await prisma.stripeEvent.update({
      where: {
        stripe_event_id: event.id
      },
      data: {
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown webhook processing error"
      }
    });

    throw error;
  }

  return result;
};
