import { afterEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('apiRequest resilience for session verification', () => {
  it('converts network/CORS fetch rejections into NETWORK_ERROR envelopes instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    const { apiRequest } = await import('../api/client');
    const result = await apiRequest('/auth/me', { method: 'GET' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NETWORK_ERROR');
      expect(result.error.message).toContain('Unable to reach OCTOPUS API');
    }
  });

  it('normalizes non-JSON error responses (e.g. 502 HTML) cleanly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      })),
    );

    const { apiRequest } = await import('../api/client');
    const result = await apiRequest('/auth/me', { method: 'GET' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('HTTP_502');
    }
  });

  it('normalizes raw Fastify 404 responses cleanly into ApiResponse envelopes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        json: async () => ({
          message: 'Route GET:/api/v1explai/auth/me not found',
          error: 'Not Found',
          statusCode: 404,
        }),
      })),
    );

    const { apiRequest } = await import('../api/client');
    const result = await apiRequest('/auth/me', { method: 'GET' });

    expect(result).toEqual({
      success: false,
      error: {
        code: 'HTTP_404',
        message: 'Route GET:/api/v1explai/auth/me not found',
      },
    });
  });

  it('converts AbortError timeouts into REQUEST_TIMEOUT envelopes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const abortErr = new Error('The operation was aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }),
    );

    const { apiRequest } = await import('../api/client');
    const result = await apiRequest('/auth/me', { method: 'GET' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('REQUEST_TIMEOUT');
    }
  });
});
