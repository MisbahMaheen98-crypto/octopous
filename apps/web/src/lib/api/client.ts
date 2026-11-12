import type { ApiResponse } from '@octopus/shared';

const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

/** Resolve the OCTOPUS API base URL for configured, same-origin production, and local Vite dev environments. */
export function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/u, '');
  }

  if (typeof window !== 'undefined' && window.location) {
    const { hostname, port, origin } = window.location;
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
    if (isLocalHost && port !== '4000') {
      return 'http://localhost:4000/api/v1';
    }
    if (origin && origin.startsWith('http')) {
      return `${origin}/api/v1`;
    }
  }

  return 'http://localhost:4000/api/v1';
}

const baseUrl = resolveApiBaseUrl();

export const apiBaseUrl = baseUrl;

export type ApiBinaryResponse = {
  blob: Blob;
  fileName: string | null;
};

function joinApiUrl(rootUrl: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (rootUrl.endsWith('/api/v1') && normalizedPath.startsWith('/api/v1/')) {
    return `${rootUrl}${normalizedPath.slice('/api/v1'.length)}`;
  }
  return `${rootUrl}${normalizedPath}`;
}

export async function apiDownload(path: string, fallbackFileName: string): Promise<ApiBinaryResponse> {
  const response = await fetch(joinApiUrl(baseUrl, path), {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/zip',
    },
  });

  if (!response.ok) {
    let message = `Download failed (${response.status})`;

    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      if (payload?.error?.message) {
        message = payload.error.message;
      }
    } catch {
      // Response was not JSON; keep the status-based message.
    }

    throw new Error(message);
  }

  const disposition = response.headers.get('content-disposition');
  const match = disposition ? /filename="?([^";]+)"?/i.exec(disposition) : null;

  return {
    blob: await response.blob(),
    fileName: match?.[1] ?? fallbackFileName,
  };
}

type ApiRequestInit = Omit<RequestInit, 'body' | 'headers'> & {
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export async function apiRequest<T>(
  path: string,
  init?: ApiRequestInit,
): Promise<ApiResponse<T>> {
  const { body: rawBody, headers: initHeaders, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, signal, ...rest } = init ?? {};
  const serializedBody = rawBody !== undefined ? JSON.stringify(rawBody) : undefined;
  const headers: Record<string, string> = {
    ...(serializedBody ? { 'Content-Type': 'application/json' } : {}),
    ...(initHeaders ?? {}),
  };

  const controller = signal ? null : new AbortController();
  const timeoutId =
    controller && timeoutMs > 0
      ? setTimeout(() => {
          controller.abort();
        }, timeoutMs)
      : null;

  const requestInit: RequestInit = {
    credentials: 'include',
    ...rest,
    headers,
    signal: signal ?? controller?.signal ?? null,
  };

  if (serializedBody !== undefined) {
    requestInit.body = serializedBody;
  }

  let response: Response;
  try {
    response = await fetch(joinApiUrl(baseUrl, path), requestInit);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'Request timed out while contacting the OCTOPUS API. Please try again.',
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: `Unable to reach OCTOPUS API (${baseUrl}). Verify the backend service is running and CORS allows this origin.`,
      },
    };
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return {
      success: false,
      error: {
        code: `HTTP_${response.status || 500}`,
        message: `Unexpected non-JSON response from server (${response.status || 'unknown status'}).`,
      },
    };
  }

  if (
    parsed &&
    typeof parsed === 'object' &&
    'success' in parsed &&
    typeof (parsed as { success: unknown }).success === 'boolean'
  ) {
    return parsed as ApiResponse<T>;
  }

  const fallbackMessage =
    parsed &&
    typeof parsed === 'object' &&
    'message' in parsed &&
    typeof (parsed as { message: unknown }).message === 'string'
      ? (parsed as { message: string }).message
      : `Unexpected API response (${response.status || 'unknown status'})`;

  return {
    success: false,
    error: {
      code: `HTTP_${response.status || 500}`,
      message: fallbackMessage,
    },
  };
}
