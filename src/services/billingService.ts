import { CreditLedgerReason, Prisma, SubscriptionStatus } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../utils/prisma";
import { HttpError } from "../utils/httpError";
import { addCredits, resetMonthlyCredits } from "./creditService";
import {
  getCreditPackByKey,
  getPlanByKey,
  getPlanByPriceId
} from "./billingCatalog";
import { getStripe } from "./stripeService";
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
  items: {
    data: Array<{
      current_period_end?: number;
      price: {
        id: string;
      };
    }>;
  };
};

type StripeCheckoutSessionLike = {
  id: string;
  mode: "payment" | "setup" | "subscription" | null;
  customer: StripeCustomerRef;
  subscription?: string | { id: string } | null;
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

const appUrl = (): string => env.appUrl || env.apiBaseUrl || `http://localhost:${env.port}`;

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

export const createCheckoutSession = async (
  userId: string,
  input: CheckoutSessionInput
): Promise<CheckoutSessionResult> => {
  const customerId = await getCustomerId(userId);
  const baseUrl = appUrl().replace(/\/$/, "");

  if (input.type === "subscription") {
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
      success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/billing/cancel`,
      allow_promotion_codes: true,
      metadata: {
        userId,
        checkoutType: "subscription",
        plan: plan.plan
      },
      subscription_data: {
        metadata: {
          userId,
          plan: plan.plan
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
      success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/billing/cancel`,
      metadata: {
        userId,
        checkoutType: "credit_pack",
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
  }

  throw new HttpError(400, "Invalid checkout session type");
};

export const createCustomerPortalSession = async (userId: string): Promise<PortalSessionResult> => {
  const customerId = await getCustomerId(userId);
  const baseUrl = appUrl().replace(/\/$/, "");
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl}/account/billing`
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

const upsertSubscriptionFromStripe = async (
  subscription: StripeSubscriptionLike,
  fallbackUserId?: string
): Promise<void> => {
  const priceId = subscription.items.data[0]?.price.id ?? "";
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

  const currentPeriodEndSeconds = subscription.items.data[0]?.current_period_end;
  const currentPeriodEnd = new Date((currentPeriodEndSeconds ?? Math.floor(Date.now() / 1000)) * 1000);

  await prisma.subscription.upsert({
    where: {
      stripe_subscription_id: subscription.id
    },
    update: {
      user_id: userId,
      plan: plan.plan,
      status: stripeStatusToSubscriptionStatus(subscription.status),
      current_period_end: currentPeriodEnd,
      stripe_price_id: priceId,
      cancel_at_period_end: subscription.cancel_at_period_end
    },
    create: {
      user_id: userId,
      plan: plan.plan,
      status: stripeStatusToSubscriptionStatus(subscription.status),
      current_period_end: currentPeriodEnd,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      cancel_at_period_end: subscription.cancel_at_period_end
    }
  });
};

const handleCheckoutSessionCompleted = async (session: StripeCheckoutSessionLike): Promise<void> => {
  const customerId = getCustomerIdFromStripeObject(session.customer);
  const userId = session.metadata?.userId;

  if (customerId && userId) {
    await prisma.user.update({
      where: {
        id: userId
      },
      data: {
        stripe_customer_id: customerId
      }
    });
  }

  if (session.mode === "subscription" && session.subscription) {
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription.id;
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId) as unknown as StripeSubscriptionLike;
    await upsertSubscriptionFromStripe(subscription, userId);
    return;
  }

  if (session.mode === "payment" && userId) {
    const packKey = session.metadata?.pack;
    const pack = packKey ? getCreditPackByKey(packKey) : null;

    if (pack) {
      await addCredits(userId, pack.credits, CreditLedgerReason.purchase, {
        idempotencyKey: `stripe-checkout:${session.id}:credits`
      });
    }
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

  await resetMonthlyCredits(localSubscription.user_id, localSubscription.plan, {
    idempotencyKey: `stripe-invoice:${invoice.id}:monthly-reset`
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
};

export const processStripeEvent = async (event: StripeWebhookEvent): Promise<"processed" | "duplicate" | "ignored"> => {
  try {
    await prisma.stripeEvent.create({
      data: {
        id: event.id,
        type: event.type
      }
    });
  } catch (error) {
    if (isKnownPrismaError(error) && error.code === "P2002") {
      const existingEvent = await prisma.stripeEvent.findUnique({
        where: {
          id: event.id
        },
        select: {
          processed_at: true
        }
      });

      if (existingEvent?.processed_at) {
        return "duplicate";
      }
    } else {
      throw error;
    }
  }

  let result: "processed" | "ignored";

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(event.data.object as StripeCheckoutSessionLike);
      result = "processed";
      break;
    case "customer.subscription.updated":
      await upsertSubscriptionFromStripe(event.data.object as StripeSubscriptionLike);
      result = "processed";
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as StripeSubscriptionLike);
      result = "processed";
      break;
    case "invoice.paid":
      await handleInvoicePaid(event.data.object as StripeInvoiceLike);
      result = "processed";
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as StripeInvoiceLike);
      result = "processed";
      break;
    default:
      result = "ignored";
  }

  await prisma.stripeEvent.update({
    where: {
      id: event.id
    },
    data: {
      processed_at: new Date()
    }
  });

  return result;
};
