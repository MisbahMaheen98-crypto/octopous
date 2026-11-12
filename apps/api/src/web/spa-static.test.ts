import { describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';

describe('SPA static fallback & root routing', () => {
  it('serves API health endpoint under /api/v1/health', async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        data: { status: 'ok', service: 'octopus-api' },
      });
    } finally {
      await app.close();
    }
  });

  it('keeps JSON 404 for unknown /api/* routes', async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/route-does-not-exist',
      });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: 'Not Found',
        statusCode: 404,
      });
    } finally {
      await app.close();
    }
  });

  it('serves built SPA index.html or API status on GET /', async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });
      expect(response.statusCode).toBe(200);
      const contentType = String(response.headers['content-type'] ?? '');
      if (contentType.includes('text/html')) {
        expect(response.body).toContain('<div id="root">');
      } else {
        expect(response.json()).toMatchObject({ success: true, status: 'ok' });
      }
    } finally {
      await app.close();
    }
  });

  it('blocks path traversal and missing asset files with 404', async () => {
    const app = buildApp();
    try {
      const traversalRes = await app.inject({
        method: 'GET',
        url: '/%2e%2e/%2e%2e/package.json',
      });
      expect(traversalRes.statusCode).toBe(404);

      const missingAssetRes = await app.inject({
        method: 'GET',
        url: '/assets/definitely-missing-bundle-12345.js',
      });
      expect(missingAssetRes.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
