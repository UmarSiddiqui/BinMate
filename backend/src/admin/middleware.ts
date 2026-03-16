import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/** HTTP Basic Auth guard for all /admin routes. */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    res.status(503).send('Admin dashboard disabled — set ADMIN_PASSWORD to enable.');
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  if (!authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="BinMate Admin"');
    res.status(401).send('Authentication required');
    return;
  }

  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
  // Format is username:password — we validate password only (username is ignored).
  const colonIndex = decoded.indexOf(':');
  const provided = colonIndex >= 0 ? decoded.slice(colonIndex + 1) : decoded;

  if (!matchesPassword(provided, password)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="BinMate Admin"');
    res.status(401).send('Invalid credentials');
    return;
  }

  next();
}

/** Compare admin passwords without leaking timing information. */
function matchesPassword(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}
