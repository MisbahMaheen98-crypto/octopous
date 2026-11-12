import { describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';
import { parseAllowedOrigins } from './security.js';

describe('security CORS', () => {
  it('allows DELETE in preflight response', async () => {
    const app = buildApp();

    try {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/projects/project_1/snapshots/snapshot_1',
        headers: {
          origin: 'http://localhost:5173',
          'access-control-request-method': 'DELETE',
          'access-control-request-headers': 'content-type',
        },
      });

      expect(response.statusCode).toBe(204);
      const allowMethods = response.headers['access-control-allow-methods'] ?? '';
      expect(String(allowMethods)).toContain('DELETE');
    } finally {
      await app.close();
    }
  });

  it('includes CORS headers and cross-origin CORP even on 404 responses', async () => {
    const app = buildApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1explai/auth/me',
        headers: {
          origin: 'http://localhost:5173',
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
    } finally {
      await app.close();
    }
  });

  it('normalizes trailing slashes and comma-separated CORS origins', () => {
    expect(parseAllowedOrigins('https://octopus-web-ecdc.onrender.com/')).toBe(
      'https://octopus-web-ecdc.onrender.com',
    );
    expect(
      parseAllowedOrigins('https://a.onrender.com/, https://b.onrender.com '),
    ).toEqual(['https://a.onrender.com', 'https://b.onrender.com']);
  });
});
