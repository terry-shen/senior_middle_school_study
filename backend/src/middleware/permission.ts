/**
 * Permission Middleware
 * Access control for different user roles (student/admin)
 */

import { Request, Response, NextFunction } from 'express';
import { validateSessionToken } from '../services/session-service';

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        studentId: string;
        name: string;
        role: string;
        aiAssistantEnabled: boolean;
      };
    }
  }
}

type AuthUser = NonNullable<Request['user']>;

type AuthFailure = {
  ok: false;
  status: number;
  error: string;
  code: string;
};

type AuthSuccess = { ok: true; user: AuthUser };

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7).trim();
  return token || null;
}

async function authenticate(req: Request): Promise<AuthSuccess | AuthFailure> {
  const token = extractToken(req);
  if (!token) {
    return { ok: false, status: 401, error: 'Authentication required', code: 'missing' };
  }

  const result = await validateSessionToken(token);
  if (!result.ok) {
    return {
      ok: false,
      status: 401,
      error: '登录状态已失效，请重新登录',
      code: result.code,
    };
  }

  const student = result.session.student;
  return {
    ok: true,
    user: {
      id: student.id,
      studentId: student.studentId,
      name: student.name,
      role: student.role,
      aiAssistantEnabled: student.aiAssistantEnabled,
    },
  };
}

function sendAuthFailure(res: Response, failure: AuthFailure) {
  return res.status(failure.status).json({ error: failure.error, code: failure.code });
}

async function attachUserOrFail(
  req: Request,
  res: Response
): Promise<AuthUser | null> {
  if (req.user) return req.user;
  const auth = await authenticate(req);
  if (!auth.ok) {
    sendAuthFailure(res, auth);
    return null;
  }
  req.user = auth.user;
  return auth.user;
}

/**
 * Middleware to require authentication.
 * Validates the session (including idle/ended state) and attaches the user.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = await authenticate(req);
    if (!auth.ok) return sendAuthFailure(res, auth);
    req.user = auth.user;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware to require admin role.
 * Can be used after requireAuth, or standalone (will authenticate first).
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await attachUserOrFail(req, res);
    if (!user) return;
    if (user.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required',
        message: 'You do not have permission to perform this action',
      });
    }
    next();
  } catch (err) {
    console.error('Admin auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware to require student role (or admin).
 */
export async function requireStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await attachUserOrFail(req, res);
    if (!user) return;
    if (user.role !== 'student' && user.role !== 'admin') {
      return res.status(403).json({
        error: 'Student access required',
        message: 'You do not have permission to perform this action',
      });
    }
    next();
  } catch (err) {
    console.error('Student auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware to check if user owns the resource or is admin.
 */
export function requireOwnershipOrAdmin(getUserIdFromParams: (req: Request) => number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await attachUserOrFail(req, res);
      if (!user) return;

      if (user.role === 'admin') return next();

      const resourceId = getUserIdFromParams(req);
      if (user.id !== resourceId) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only access your own resources',
        });
      }

      next();
    } catch (err) {
      console.error('Ownership auth error:', err);
      res.status(500).json({ error: 'Authentication failed' });
    }
  };
}

/**
 * Optional auth - attaches user if token present and valid, but doesn't require it.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if (!extractToken(req)) return next();
    const auth = await authenticate(req);
    if (auth.ok) req.user = auth.user;
    next();
  } catch (err) {
    console.error('Optional auth error:', err);
    next();
  }
}

/**
 * Role-based access control configuration
 * Maps routes to required roles
 */
export const rolePermissions: Record<string, string[]> = {
  // Admin only routes
  '/api/students/import': ['admin'],
  '/api/students/export': ['admin'],
  '/api/classes': ['admin'],

  // Student accessible routes
  '/api/auth/me': ['student', 'admin'],
  '/api/students/:id': ['owner', 'admin'], // owner = student themselves

  // Public routes
  '/api/auth/register': [],
  '/api/auth/login': [],
  '/api/health': [],
};
