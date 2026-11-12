import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

import { env } from '../config/env.js';

export function parseAllowedOrigins(rawOrigin: string): string | string[] | false {
  const origins = rawOrigin
    .split(',')
    .map((item) => item.trim().replace(/\/+$/u, ''))
    .filter(Boolean);

  if (origins.length === 0) {
    return false;
  }

  return origins.length === 1 ? origins[0]! : origins;
}

/**
 * Registers cookie, helmet, and CORS directly on the root Fastify instance
 * synchronously so every route and 404/error response includes CORS headers.
 */
export function registerCoreSecurityPlugins(app: FastifyInstance) {
  app.register(cookie, {
    secret: env.AUTH_SESSION_SECRET,
  });

  app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  app.register(cors, {
    origin: parseAllowedOrigins(env.CORS_ORIGIN),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
}

/** Registers API rate limiting for scoped API route plugins. */
export function registerApiRateLimit(app: FastifyInstance) {
  app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
  });
}

export async function registerSecurityPlugins(app: FastifyInstance) {
  registerCoreSecurityPlugins(app);
  registerApiRateLimit(app);
}
