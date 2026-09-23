import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { db, hashPassword, verifyPassword } from './db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'autoescuela-super-secret-key-2026-xyz';

export interface AuthPayload {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'student';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

// Simple and tamper-proof HMAC-signed token generator
export function createToken(payload: AuthPayload, expiresInHours = 72): string {
  const expiresAt = Date.now() + expiresInHours * 3600 * 1000;
  const data = JSON.stringify({ ...payload, exp: expiresAt });
  const b64Data = Buffer.from(data).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(b64Data)
    .digest('base64url');
  return `${b64Data}.${signature}`;
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [b64Data, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(b64Data)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(b64Data, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }

    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

// Middleware to extract user from Authorization header
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'No autorizado. Por favor inicia sesión.' });
    return;
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'No autorizado. Por favor inicia sesión.' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
    return;
  }
  next();
}
