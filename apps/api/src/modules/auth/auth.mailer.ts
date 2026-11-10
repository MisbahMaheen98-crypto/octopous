import { env } from '../../config/env.js';
import { HttpError } from '../../core/errors/http-error.js';
import {
  getRecipientDomain,
  getSafeBrevoErrorMetadata,
  silentAuthDiagnosticLogger,
} from './auth.diagnostics.js';
import type { AuthDiagnosticLogger } from './auth.types.js';

const BREVO_EMAIL_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_REQUEST_TIMEOUT_MS = 10_000;

export class BrevoRequestError extends Error {
  public readonly code?: string | undefined;

  constructor(
    public readonly httpStatus?: number | undefined,
    public readonly providerErrorCode?: string | undefined,
    code?: string | undefined,
    public readonly detailMessage?: string | undefined,
  ) {
    super(detailMessage ? `Brevo email API request failed: ${detailMessage}` : 'Brevo email API request failed');
    this.name = 'BrevoRequestError';
    this.code = code;
  }
}

function getProviderErrorCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object' || !('code' in payload)) {
    return undefined;
  }

  const code = (payload as Record<string, unknown>).code;
  return typeof code === 'string' && /^[A-Z0-9_-]{1,64}$/iu.test(code) ? code : undefined;
}

function getProviderDetailMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object' || !('message' in payload)) {
    return undefined;
  }

  const message = (payload as Record<string, unknown>).message;
  if (typeof message !== 'string') {
    return undefined;
  }

  // Strip potential 6-digit numeric OTP sequences
  let sanitized = message.replace(/\b\d{6}\b/g, '******');
  if (sanitized.length > 250) {
    sanitized = sanitized.slice(0, 250) + '...';
  }
  return sanitized;
}

export type OtpDeliveryResult =
  | {
      otpSent: true;
    }
  | {
      otpSent: true;
      developmentOtp: string;
      deliveryMode: 'DEVELOPMENT_FALLBACK';
    };

export class AuthMailer {
  constructor(private readonly logger: AuthDiagnosticLogger = silentAuthDiagnosticLogger) {}

  private createDevelopmentFallback(otp: string): OtpDeliveryResult {
    return {
      otpSent: true,
      developmentOtp: otp,
      deliveryMode: 'DEVELOPMENT_FALLBACK',
    };
  }

  async sendEmailVerificationOtp(input: { email: string; username: string; otp: string }): Promise<OtpDeliveryResult> {
    const hasApiKey = Boolean(env.BREVO_API_KEY);
    const hasEmailFrom = Boolean(env.EMAIL_FROM);

    if (!hasApiKey || !hasEmailFrom) {
      if (env.NODE_ENV === 'production') {
        throw new HttpError(500, 'EMAIL_PROVIDER_NOT_CONFIGURED', 'Email provider must be configured');
      }

      if (hasApiKey && !hasEmailFrom) {
        throw new HttpError(
          500,
          'EMAIL_PROVIDER_NOT_CONFIGURED',
          'Sender email (EMAIL_FROM) is required when Brevo is configured',
        );
      }

      return this.createDevelopmentFallback(input.otp);
    }

    const startedAt = Date.now();
    const safeMetadata = {
      provider: 'brevo',
      transport: 'https',
      hasApiKey: true,
      hasEmailFrom: true,
      recipientDomain: getRecipientDomain(input.email),
    };
    this.logger.info(safeMetadata, 'OTP email send started');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BREVO_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(BREVO_EMAIL_API_URL, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': env.BREVO_API_KEY!,
        },
        body: JSON.stringify({
          sender: {
            email: env.EMAIL_FROM,
          },
          to: [
            {
              email: input.email,
            },
          ],
          subject: 'OCTOPUS verification code',
          htmlContent: `<p>Hello ${input.username},</p><p>Your OCTOPUS verification code is <strong>${input.otp}</strong>.</p><p>It expires in ${env.AUTH_OTP_TTL_MINUTES} minutes.</p>`,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let providerErrorCode: string | undefined;
        let detailMessage: string | undefined;
        try {
          const body = await response.json();
          providerErrorCode = getProviderErrorCode(body);
          detailMessage = getProviderDetailMessage(body);
        } catch {
          // Do not log response bodies; they may contain recipient or message data.
        }
        throw new BrevoRequestError(response.status, providerErrorCode, 'BREVO_HTTP_ERROR', detailMessage);
      }

      this.logger.info(
        { ...safeMetadata, httpStatus: response.status, elapsedMs: Date.now() - startedAt },
        'OTP email send completed',
      );

      return {
        otpSent: true,
      } satisfies OtpDeliveryResult;
    } catch (error) {
      const safeError = controller.signal.aborted
        ? new BrevoRequestError(undefined, undefined, 'BREVO_HTTP_TIMEOUT')
        : error;
      const failureMetadata = {
        ...safeMetadata,
        elapsedMs: Date.now() - startedAt,
        ...getSafeBrevoErrorMetadata(safeError),
      };

      if (controller.signal.aborted || (safeError instanceof BrevoRequestError && safeError.code === 'BREVO_HTTP_TIMEOUT')) {
        this.logger.error(failureMetadata, 'OTP email send timed out');
      } else {
        this.logger.error(failureMetadata, 'OTP email send failed');
      }

      if (env.NODE_ENV === 'production') {
        throw new HttpError(503, 'EMAIL_DELIVERY_FAILED', 'Email delivery failed');
      }

      let userMessage = 'Email delivery failed';
      if (safeError instanceof BrevoRequestError) {
        if (safeError.providerErrorCode === 'unauthorized') {
          userMessage = safeError.detailMessage?.includes('authorised_ips') || safeError.detailMessage?.includes('unrecognised IP')
            ? 'Email delivery failed: Brevo IP restriction blocked request. Authorize your IP at https://app.brevo.com/security/authorised_ips'
            : 'Email delivery failed: Brevo API key is unauthorized.';
        } else if (
          safeError.providerErrorCode === 'unverified_sender' ||
          safeError.detailMessage?.toLowerCase().includes('sender')
        ) {
          userMessage = 'Email delivery failed: Brevo sender email is not verified.';
        } else if (safeError.code === 'BREVO_HTTP_TIMEOUT') {
          userMessage = 'Email delivery failed: Request to Brevo timed out.';
        } else if (safeError.detailMessage) {
          userMessage = `Email delivery failed: ${safeError.detailMessage}`;
        }
      } else if (
        safeError instanceof Error &&
        (safeError.name === 'AbortError' || (safeError as { code?: string }).code === 'BREVO_HTTP_TIMEOUT')
      ) {
        userMessage = 'Email delivery failed: Request to Brevo timed out.';
      } else if (safeError instanceof Error) {
        userMessage = `Email delivery failed: ${safeError.message}`;
      }

      throw new HttpError(503, 'EMAIL_DELIVERY_FAILED', userMessage);
    } finally {
      clearTimeout(timeout);
    }
  }
}
