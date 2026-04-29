import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { env } from "../config/env";

export type EmailSendStatus = "sent" | "failed" | "skipped";

export type EmailSendResult = {
  status: EmailSendStatus;
  provider: "smtp" | null;
  providerMessageId?: string;
  summary?: string;
};

type DownloadEmailInput = {
  toEmail: string;
  pluginName: string;
  version: string;
  downloadUrl: string;
};

let smtpTransporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null = null;

const redactSecret = (value: string, secret: string): string => {
  if (!secret) return value;
  return value.split(secret).join("[redacted]");
};

const safeErrorSummary = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error);
  return redactSecret(redactSecret(redactSecret(raw, env.smtpPass), env.smtpUser), env.mailFromEmail)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .slice(0, 500);
};

const isSmtpConfigured = (): boolean =>
  env.mailProvider === "smtp" &&
  Boolean(env.mailFromEmail) &&
  Boolean(env.smtpHost) &&
  Boolean(env.smtpUser) &&
  Boolean(env.smtpPass);

const getTransporter = () => {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000
    });
  }

  return smtpTransporter;
};

const formatFrom = (): string =>
  env.mailFromName
    ? `"${env.mailFromName.replace(/"/g, "")}" <${env.mailFromEmail}>`
    : env.mailFromEmail;

export const getEmailConfigurationStatus = () => ({
  mailProvider: env.mailProvider || "missing",
  downloadEmailEnabled: env.downloadEmailEnabled,
  feedbackEmailEnabled: env.feedbackEmailEnabled,
  smtpHostPresent: Boolean(env.smtpHost),
  smtpUserPresent: Boolean(env.smtpUser),
  mailFromEmailPresent: Boolean(env.mailFromEmail),
  smtpReady: isSmtpConfigured()
});

export const sendPluginDownloadEmail = async (input: DownloadEmailInput): Promise<EmailSendResult> => {
  if (!env.downloadEmailEnabled) {
    return { status: "skipped", provider: null, summary: "download_email_disabled" };
  }

  if (env.mailProvider !== "smtp") {
    return { status: "skipped", provider: null, summary: "smtp_provider_not_configured" };
  }

  if (!isSmtpConfigured()) {
    return { status: "skipped", provider: "smtp", summary: "smtp_configuration_incomplete" };
  }

  const text = [
    "Hi,",
    "",
    "Your Optivra plugin download is ready.",
    "",
    `Plugin: ${input.pluginName}`,
    `Version: ${input.version}`,
    "",
    "Download:",
    input.downloadUrl,
    "",
    "Setup guide:",
    "https://www.optivra.app/docs",
    "",
    "Support:",
    "https://www.optivra.app/support",
    "",
    "Thanks,",
    "Optivra"
  ].join("\n");

  try {
    const result = await getTransporter().sendMail({
      from: formatFrom(),
      to: input.toEmail,
      replyTo: env.mailReplyTo || undefined,
      subject: "Your Optivra plugin download",
      text
    });

    return {
      status: "sent",
      provider: "smtp",
      providerMessageId: result.messageId
    };
  } catch (error) {
    return {
      status: "failed",
      provider: "smtp",
      summary: safeErrorSummary(error)
    };
  }
};

export const sendDiagnosticEmail = async (toEmail: string): Promise<EmailSendResult> => {
  if (env.mailProvider !== "smtp") {
    return { status: "skipped", provider: null, summary: "smtp_provider_not_configured" };
  }

  if (!isSmtpConfigured()) {
    return { status: "skipped", provider: "smtp", summary: "smtp_configuration_incomplete" };
  }

  try {
    const result = await getTransporter().sendMail({
      from: formatFrom(),
      to: toEmail,
      replyTo: env.mailReplyTo || undefined,
      subject: "Optivra SMTP diagnostic",
      text: "This is a backend-only Optivra SMTP diagnostic email."
    });

    return {
      status: "sent",
      provider: "smtp",
      providerMessageId: result.messageId
    };
  } catch (error) {
    return {
      status: "failed",
      provider: "smtp",
      summary: safeErrorSummary(error)
    };
  }
};
