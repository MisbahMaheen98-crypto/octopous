/**
 * Octo Security Layer
 * Prevents Octo from accessing or revealing secrets, passwords, tokens, and other sensitive data.
 * Includes path traversal validation, sensitive file detection, secret redaction, and audit logging.
 */

import path from 'path';
import { logger } from './octo.logger.js';

const SENSITIVE_PATTERNS = [
  /^\.env/i,
  /\.pem$/i,
  /\.key$/i,
  /^id_rsa/i,
  /^credentials/i,
  /\.pfx$/i,
  /\.p12$/i,
  /\.secret/i,
];

const SECRET_REPLACEMENT_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  // Generic API keys (e.g. sk-..., ai-...)
  { regex: /(sk-[a-zA-Z0-9_-]{20,})/g, replacement: '[REDACTED_API_KEY]' },
  { regex: /(AIza[0-9A-Za-z-_]{35})/g, replacement: '[REDACTED_GOOGLE_KEY]' },
  // Bearer tokens
  { regex: /(Bearer\s+)[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi, replacement: '$1[REDACTED_JWT_TOKEN]' },
  // AWS Access Key ID
  { regex: /(AKIA[0-9A-Z]{16})/g, replacement: '[REDACTED_AWS_KEY]' },
  // Passwords in config/JSON
  { regex: /("password"\s*:\s*")[^"]+(")/gi, replacement: '$1[REDACTED_PASSWORD]$2' },
  { regex: /("secret"\s*:\s*")[^"]+(")/gi, replacement: '$1[REDACTED_SECRET]$2' },
];

export class SecurityGuard {
  /**
   * Validates and resolves that a target relative path stays strictly within the allowed root directory.
   */
  public static validatePathWithinProject(rootPath: string, relativeOrTargetPath: string): string {
    const resolvedRoot = path.resolve(rootPath);
    const resolvedTarget = path.isAbsolute(relativeOrTargetPath)
      ? path.resolve(relativeOrTargetPath)
      : path.resolve(resolvedRoot, relativeOrTargetPath);

    const relative = path.relative(resolvedRoot, resolvedTarget);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      logger.warn('SecurityGuard', `Path traversal attempt blocked: ${relativeOrTargetPath} from ${rootPath}`);
      throw new Error(`Access denied: Target path '${relativeOrTargetPath}' is outside project boundary.`);
    }

    return resolvedTarget;
  }

  /**
   * Checks if a filename or path indicates a sensitive file that should not be read, indexed, or exported.
   */
  public static isSensitiveFile(filePath: string): boolean {
    const baseName = path.basename(filePath);
    return SENSITIVE_PATTERNS.some((pattern) => pattern.test(baseName));
  }

  /**
   * Redacts credentials, tokens, and keys from text before transmitting to external AI models or logging.
   */
  public static redactSecrets(content: string): string {
    if (!content) return '';
    let sanitized = content;
    for (const { regex, replacement } of SECRET_REPLACEMENT_PATTERNS) {
      sanitized = sanitized.replace(regex, replacement);
    }
    return sanitized;
  }

  /**
   * Records an audit log for an impactful operation.
   */
  public static logAudit(action: string, details: Record<string, any>): void {
    logger.info('AUDIT_LOG', `Action: ${action}`, {
      action,
      timestamp: new Date().toISOString(),
      ...details,
    });
  }
}

// Backward-compatibility functions
export function checkSecurityBoundary(query: string, _intentMatch?: any): { isBlocked: boolean; message?: string } {
  const lower = query.toLowerCase();
  if (
    lower.includes('password') ||
    lower.includes('api key') ||
    lower.includes('apikey') ||
    lower.includes('secret') ||
    lower.includes('token') ||
    lower.includes('credential') ||
    isQuerySensitive(query)
  ) {
    return {
      isBlocked: true,
      message: "I can't access passwords, secret keys, or authentication tokens for security reasons.",
    };
  }
  return { isBlocked: false };
}

export function isQuerySensitive(query: string): boolean {
  const lower = query.toLowerCase();
  return SENSITIVE_PATTERNS.some((p) => p.test(lower)) || /password|secret|vault|apikey|api_key|token|credential/i.test(lower);
}

export function sanitizeOctoResponse(response: string): string {
  return SecurityGuard.redactSecrets(response);
}
