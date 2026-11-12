import type { FastifyReply } from 'fastify';

import { env } from '../../config/env.js';

export const SESSION_COOKIE_NAME = 'octopus_session';

function useCrossSiteCookieAttributes(): boolean {
  return env.NODE_ENV === 'production' || process.env.RENDER === 'true';
}

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date) {
  const isCrossSite = useCrossSiteCookieAttributes();
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isCrossSite,
    sameSite: isCrossSite ? 'none' : 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  const isCrossSite = useCrossSiteCookieAttributes();
  reply.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isCrossSite,
    sameSite: isCrossSite ? 'none' : 'lax',
    path: '/',
  });
}
