import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveWebDistDir(): string | null {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(currentDir, '../../../web/dist'),
    path.resolve(process.cwd(), 'apps/web/dist'),
    path.resolve(process.cwd(), '../web/dist'),
  ];

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }

  return null;
}

function sendNotFound(request: FastifyRequest, reply: FastifyReply) {
  return reply.status(404).send({
    message: `Route ${request.method}:${request.url} not found`,
    error: 'Not Found',
    statusCode: 404,
  });
}

function looksLikeMissingAsset(urlPath: string): boolean {
  if (urlPath.startsWith('/assets/') || urlPath.startsWith('/branding/')) {
    return true;
  }

  const ext = path.extname(urlPath).toLowerCase();
  return ext.length > 0 && ext !== '.html';
}

async function sendStaticFile(
  filePath: string,
  method: string,
  urlPath: string,
  reply: FastifyReply,
) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
  const cacheControl =
    urlPath.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : ext === '.html'
        ? 'no-cache'
        : 'public, max-age=3600';

  const buffer = await readFile(filePath);

  reply
    .status(200)
    .header('Content-Type', contentType)
    .header('Cache-Control', cacheControl)
    .header('X-Content-Type-Options', 'nosniff');

  if (method === 'HEAD') {
    return reply.header('Content-Length', String(buffer.byteLength)).send();
  }

  return reply.send(buffer);
}

/**
 * Registers root health fallback and, when the built web SPA bundle is present,
 * serves frontend static assets and client-side SPA routes without intercepting /api/*.
 */
export function registerWebSpaFallback(app: FastifyInstance): void {
  app.setNotFoundHandler(async (request, reply) => {
    const rawPathname = request.url.split('?')[0] ?? '/';
    const isApiPath = rawPathname === '/api' || rawPathname.startsWith('/api/');
    const isReadMethod = request.method === 'GET' || request.method === 'HEAD';

    if (isApiPath || !isReadMethod) {
      return sendNotFound(request, reply);
    }

    const webDistDir = resolveWebDistDir();
    if (!webDistDir) {
      if (rawPathname === '/') {
        return reply.status(200).send({
          success: true,
          service: 'octopus-api',
          status: 'ok',
          health: '/api/v1/health',
        });
      }
      return sendNotFound(request, reply);
    }

    let decodedPathname: string;
    try {
      decodedPathname = decodeURIComponent(rawPathname);
    } catch {
      return reply.status(400).send({
        message: 'Invalid URL encoding',
        error: 'Bad Request',
        statusCode: 400,
      });
    }

    if (decodedPathname.includes('\0')) {
      return reply.status(400).send({
        message: 'Invalid path',
        error: 'Bad Request',
        statusCode: 400,
      });
    }

    const relativePath = decodedPathname.replace(/^\/+/u, '');
    if (relativePath.length > 0) {
      const candidatePath = path.resolve(webDistDir, relativePath);
      const distRootWithSep = `${webDistDir}${path.sep}`;

      if (candidatePath !== webDistDir && !candidatePath.startsWith(distRootWithSep)) {
        return sendNotFound(request, reply);
      }

      try {
        const entryStat = await stat(candidatePath);
        if (entryStat.isFile()) {
          return await sendStaticFile(candidatePath, request.method, decodedPathname, reply);
        }
      } catch {
        // File does not exist; fall through to asset check or SPA index.html
      }

      if (looksLikeMissingAsset(decodedPathname)) {
        return sendNotFound(request, reply);
      }
    }

    const indexPath = path.join(webDistDir, 'index.html');
    return await sendStaticFile(indexPath, request.method, '/index.html', reply);
  });
}
