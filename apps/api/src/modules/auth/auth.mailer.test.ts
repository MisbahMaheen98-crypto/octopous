import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type EnvOverrides = {
  NODE_ENV?: 'development' | 'test' | 'production' | undefined;
  BREVO_API_KEY?: string | undefined;
  EMAIL_FROM?: string | undefined;
  AUTH_OTP_TTL_MINUTES?: number | undefined;
};

type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

const successfulResponse = (): MockResponse => ({
  ok: true,
  status: 201,
  json: async () => ({ messageId: '<brevo-message-id-123>' }),
});

async function loadMailerForTest(envOverrides: EnvOverrides, fetchImpl?: typeof fetch) {
  vi.resetModules();

  const fetchMock = vi.fn(fetchImpl ?? (async () => successfulResponse() as unknown as Response));
  vi.stubGlobal('fetch', fetchMock);

  const logs: Array<{ level: 'info' | 'error'; bindings: Record<string, unknown>; message: string }> = [];
  const logger = {
    info: vi.fn((bindings: Record<string, unknown>, message: string) => {
      logs.push({ level: 'info', bindings, message });
    }),
    error: vi.fn((bindings: Record<string, unknown>, message: string) => {
      logs.push({ level: 'error', bindings, message });
    }),
  };

  vi.doMock('../../config/env.js', () => ({
    env: {
      NODE_ENV: 'development',
      AUTH_OTP_TTL_MINUTES: 10,
      ...envOverrides,
    },
  }));

  const mod = await import('./auth.mailer.js');

  return {
    AuthMailer: mod.AuthMailer,
    fetchMock,
    logger,
    logs,
  };
}

describe('AuthMailer via Brevo HTTPS API', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // 1. Successful Brevo email delivery
  it('1. Successful Brevo email delivery: sends OTP email and logs safe metadata', async () => {
    const apiKey = 'brevo-api-key-sensitive-12345';
    const otp = '849201';
    const recipient = 'recipient.test@gmail.com';
    const { AuthMailer, fetchMock, logger, logs } = await loadMailerForTest({
      NODE_ENV: 'production',
      BREVO_API_KEY: apiKey,
      EMAIL_FROM: 'verified-sender@example.com',
      AUTH_OTP_TTL_MINUTES: 10,
    });

    const mailer = new AuthMailer(logger);
    const result = await mailer.sendEmailVerificationOtp({
      email: recipient,
      username: 'alice',
      otp,
    });

    expect(result).toEqual({ otpSent: true });
    expect(result).not.toHaveProperty('developmentOtp');
    expect(result).not.toHaveProperty('deliveryMode');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('api-key')).toBe(apiKey);
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
    expect(init.signal).toBeInstanceOf(AbortSignal);

    expect(JSON.parse(String(init.body))).toEqual({
      sender: { email: 'verified-sender@example.com' },
      to: [{ email: recipient }],
      subject: 'OCTOPUS verification code',
      htmlContent: `<p>Hello alice,</p><p>Your OCTOPUS verification code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
    });

    expect(logs.map(({ message }) => message)).toEqual([
      'OTP email send started',
      'OTP email send completed',
    ]);

    const serializedLogs = JSON.stringify(logs);
    expect(serializedLogs).toContain('provider":"brevo');
    expect(serializedLogs).toContain('transport":"https');
    expect(serializedLogs).toContain('hasApiKey":true');
    expect(serializedLogs).toContain('hasEmailFrom":true');
    expect(serializedLogs).toContain('gmail.com');
    expect(serializedLogs).not.toContain(apiKey);
    expect(serializedLogs).not.toContain(otp);
    expect(serializedLogs).not.toContain('recipient.test');
  });

  // 2. Missing Brevo API key
  it('2. Missing Brevo API key: throws in production', async () => {
    const { AuthMailer, fetchMock } = await loadMailerForTest({
      NODE_ENV: 'production',
      EMAIL_FROM: 'verified-sender@example.com',
    });

    const mailer = new AuthMailer();
    await expect(
      mailer.sendEmailVerificationOtp({
        email: 'alice@gmail.com',
        username: 'alice',
        otp: '123456',
      }),
    ).rejects.toMatchObject({
      statusCode: 500,
      code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // 3. Missing sender email
  it('3. Missing sender email: throws when Brevo API key is present in development', async () => {
    const { AuthMailer, fetchMock } = await loadMailerForTest({
      NODE_ENV: 'development',
      BREVO_API_KEY: 'brevo-configured-key',
    });

    const mailer = new AuthMailer();
    await expect(
      mailer.sendEmailVerificationOtp({
        email: 'alice@gmail.com',
        username: 'alice',
        otp: '123456',
      }),
    ).rejects.toMatchObject({
      statusCode: 500,
      code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
      message: expect.stringContaining('EMAIL_FROM'),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // 4. Invalid Brevo API key
  it('4. Invalid Brevo API key: returns clear error in development and does NOT fallback', async () => {
    const apiKey = 'invalid-api-key';
    const { AuthMailer, logger, logs } = await loadMailerForTest(
      {
        NODE_ENV: 'development',
        BREVO_API_KEY: apiKey,
        EMAIL_FROM: 'sender@example.com',
      },
      async () => ({
        ok: false,
        status: 401,
        json: async () => ({
          code: 'unauthorized',
          message: 'Key not found',
        }),
      }) as Response,
    );

    const mailer = new AuthMailer(logger);
    await expect(
      mailer.sendEmailVerificationOtp({
        email: 'alice@gmail.com',
        username: 'alice',
        otp: '123456',
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'EMAIL_DELIVERY_FAILED',
      message: expect.stringContaining('unauthorized'),
    });

    expect(logs.at(-1)).toMatchObject({
      level: 'error',
      message: 'OTP email send failed',
      bindings: {
        provider: 'brevo',
        httpStatus: 401,
        providerErrorCode: 'unauthorized',
      },
    });
  });

  // 5. Unverified sender
  it('5. Unverified sender: returns clear error for unverified sender', async () => {
    const { AuthMailer, logger, logs } = await loadMailerForTest(
      {
        NODE_ENV: 'development',
        BREVO_API_KEY: 'valid-key',
        EMAIL_FROM: 'unverified@example.com',
      },
      async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          code: 'unverified_sender',
          message: 'Sender is not verified',
        }),
      }) as Response,
    );

    const mailer = new AuthMailer(logger);
    await expect(
      mailer.sendEmailVerificationOtp({
        email: 'alice@gmail.com',
        username: 'alice',
        otp: '123456',
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'EMAIL_DELIVERY_FAILED',
      message: expect.stringContaining('verified'),
    });

    expect(logs.at(-1)).toMatchObject({
      level: 'error',
      message: 'OTP email send failed',
      bindings: {
        provider: 'brevo',
        httpStatus: 400,
        providerErrorCode: 'unverified_sender',
      },
    });
  });

  // 6. Brevo HTTP failure
  it('6. Brevo HTTP failure: logs status and error code', async () => {
    const { AuthMailer, logger, logs } = await loadMailerForTest(
      {
        NODE_ENV: 'production',
        BREVO_API_KEY: 'valid-key',
        EMAIL_FROM: 'sender@example.com',
      },
      async () => ({
        ok: false,
        status: 500,
        json: async () => ({
          code: 'internal_server_error',
          message: 'Internal server error',
        }),
      }) as Response,
    );

    const mailer = new AuthMailer(logger);
    await expect(
      mailer.sendEmailVerificationOtp({
        email: 'alice@gmail.com',
        username: 'alice',
        otp: '123456',
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'EMAIL_DELIVERY_FAILED',
      message: 'Email delivery failed',
    });

    expect(logs.at(-1)).toMatchObject({
      level: 'error',
      message: 'OTP email send failed',
      bindings: {
        provider: 'brevo',
        httpStatus: 500,
        providerErrorCode: 'internal_server_error',
      },
    });
  });

  // 7. Network failure
  it('7. Network failure: handles fetch network exceptions gracefully', async () => {
    const { AuthMailer, logger, logs } = await loadMailerForTest(
      {
        NODE_ENV: 'production',
        BREVO_API_KEY: 'valid-key',
        EMAIL_FROM: 'sender@example.com',
      },
      async () => {
        throw new TypeError('fetch failed');
      },
    );

    const mailer = new AuthMailer(logger);
    await expect(
      mailer.sendEmailVerificationOtp({
        email: 'alice@gmail.com',
        username: 'alice',
        otp: '123456',
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'EMAIL_DELIVERY_FAILED',
      message: 'Email delivery failed',
    });

    expect(logs.at(-1)).toMatchObject({
      level: 'error',
      message: 'OTP email send failed',
      bindings: {
        provider: 'brevo',
      },
    });
  });

  // 8. Request timeout
  it('8. Request timeout: aborts request after timeout and logs timeout metadata', async () => {
    vi.useFakeTimers();
    const { AuthMailer, logger, logs } = await loadMailerForTest(
      {
        NODE_ENV: 'production',
        BREVO_API_KEY: 'valid-key',
        EMAIL_FROM: 'sender@example.com',
      },
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }) as Promise<Response>,
    );

    const mailer = new AuthMailer(logger);
    const sendPromise = mailer.sendEmailVerificationOtp({
      email: 'alice@gmail.com',
      username: 'alice',
      otp: '123456',
    });
    const rejection = expect(sendPromise).rejects.toMatchObject({
      statusCode: 503,
      code: 'EMAIL_DELIVERY_FAILED',
      message: 'Email delivery failed',
    });

    await vi.advanceTimersByTimeAsync(10_000);
    await rejection;

    expect(logs.at(-1)).toMatchObject({
      level: 'error',
      message: 'OTP email send timed out',
      bindings: {
        provider: 'brevo',
        transport: 'https',
        errorCode: 'BREVO_HTTP_TIMEOUT',
        isTimeout: true,
      },
    });
  });

  // 9. Development fallback when Brevo is intentionally unconfigured
  it('9. Development fallback when Brevo is intentionally unconfigured: returns developmentOtp', async () => {
    const { AuthMailer, fetchMock } = await loadMailerForTest({
      NODE_ENV: 'development',
      BREVO_API_KEY: undefined,
      EMAIL_FROM: undefined,
    });

    const mailer = new AuthMailer();
    const result = await mailer.sendEmailVerificationOtp({
      email: 'alice@gmail.com',
      username: 'alice',
      otp: '987654',
    });

    expect(result).toEqual({
      otpSent: true,
      developmentOtp: '987654',
      deliveryMode: 'DEVELOPMENT_FALLBACK',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // 10. No development OTP returned in production
  it('10. No development OTP returned in production: never exposes developmentOtp in production', async () => {
    const { AuthMailer, fetchMock } = await loadMailerForTest({
      NODE_ENV: 'production',
      BREVO_API_KEY: 'brevo-prod-key',
      EMAIL_FROM: 'noreply@octopus.dev',
    });

    const mailer = new AuthMailer();
    const result = await mailer.sendEmailVerificationOtp({
      email: 'alice@gmail.com',
      username: 'alice',
      otp: '445566',
    });

    expect(result).toEqual({ otpSent: true });
    expect(result).not.toHaveProperty('developmentOtp');
    expect(result).not.toHaveProperty('deliveryMode');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
