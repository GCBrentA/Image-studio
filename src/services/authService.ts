import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { HttpError } from "../utils/httpError";
import { createJwt } from "../utils/jwt";
import { hashPassword, verifyPassword } from "../utils/password";

type AuthResult = {
  token: string;
  user: {
    id: string;
    email: string;
  };
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const registerUser = async (email: string, password: string): Promise<AuthResult> => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || password.length < 8) {
    throw new HttpError(400, "A valid email and password of at least 8 characters are required");
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email: normalizedEmail
    },
    select: {
      id: true
    }
  });

  if (existingUser) {
    throw new HttpError(409, "An account already exists for this email");
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const user = await prisma.$transaction(async (transaction) => {
    const createdUser = await transaction.user.create({
      data: {
        email: normalizedEmail,
        password_hash: hashPassword(password),
        billing_plan: SubscriptionPlan.starter,
        billing_status: SubscriptionStatus.trialing,
        current_period_end: trialEndsAt,
        credits_included: 0,
        credits_remaining: 0,
        credits_used: 0,
        credits_reset_at: trialEndsAt
      },
      select: {
        id: true,
        email: true
      }
    });

    await transaction.subscription.create({
      data: {
        user_id: createdUser.id,
        plan: SubscriptionPlan.starter,
        status: SubscriptionStatus.trialing,
        current_period_end: trialEndsAt,
        credits_included: 0,
        credits_remaining: 0,
        credits_used: 0,
        credits_reset_at: trialEndsAt
      }
    });

    return createdUser;
  });

  return {
    token: createJwt(user),
    user
  };
};

export const loginUser = async (email: string, password: string): Promise<AuthResult> => {
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail
    },
    select: {
      id: true,
      email: true,
      password_hash: true
    }
  });

  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new HttpError(401, "Invalid email or password");
  }

  return {
    token: createJwt(user),
    user: {
      id: user.id,
      email: user.email
    }
  };
};
