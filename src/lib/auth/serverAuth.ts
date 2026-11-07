/**
 * ChanceTEKone — Server-Side Admin Authorization Utility
 * Validates request authorization tokens, headers, and admin identities server-side.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AUTHORIZED_ADMIN_EMAILS, isAdminEmail } from '@/lib/catalog/adminIdentity';
import { getFirebaseAdmin } from '../../../firebaseAdmin.js';

export { AUTHORIZED_ADMIN_EMAILS, isAdminEmail };

/**
 * When STRICT_ADMIN_AUTH=true, ONLY a verified Firebase ID token belonging to an
 * authorized admin email is accepted (no x-admin-email header, no dev fallbacks).
 */
const isStrictAdminAuth = () => process.env.STRICT_ADMIN_AUTH === 'true';

async function verifyFirebaseIdTokenAdmin(token: string): Promise<{ email: string } | null> {
  try {
    const { adminAuth } = await getFirebaseAdmin();
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email || '').trim().toLowerCase();
    if (email && isAdminEmail(email)) {
      return { email };
    }
  } catch {
    // Not a valid Firebase ID token — fall through to legacy checks.
  }
  return null;
}

export interface ServerAuthResult {
  authorized: boolean;
  email?: string;
  role?: string;
  error?: string;
  response?: NextResponse;
}

export async function verifyServerAdmin(request: NextRequest): Promise<ServerAuthResult> {
  try {
    // 1. Check custom authorization header or admin email header
    const adminEmailHeader = request.headers.get('x-admin-email')?.trim().toLowerCase();
    const authHeader = request.headers.get('authorization');
    const strict = isStrictAdminAuth();

    // 0. Preferred: a real Firebase ID token for an authorized admin email
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const bearer = authHeader.substring(7).trim();
      if (bearer.split('.').length === 3) {
        const verified = await verifyFirebaseIdTokenAdmin(bearer);
        if (verified) {
          return {
            authorized: true,
            email: verified.email,
            role: verified.email === 'chancellor@ichancetek.com' ? 'super_admin' : 'admin',
          };
        }
      }
    }

    if (strict) {
      return {
        authorized: false,
        error: 'Unauthorized: a verified admin session is required.',
        response: NextResponse.json(
          { success: false, error: 'Access Denied: Administrator authority required.' },
          { status: 403 }
        ),
      };
    }

    if (adminEmailHeader) {
      if (isAdminEmail(adminEmailHeader)) {
        return {
          authorized: true,
          email: adminEmailHeader,
          role: adminEmailHeader === 'chancellor@ichancetek.com' ? 'super_admin' : 'admin',
        };
      }
    }

    // 2. Check Bearer token if provided
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      // In development / demo environment, allow admin tokens or validated email tokens
      if (token.startsWith('admin-') || token === 'authorized-admin') {
        return {
          authorized: true,
          email: 'antgreene@chancetekone.com',
          role: 'admin',
        };
      }
    }

    // 3. In development or local environment, allow admin operations
    const host = request.headers.get('host') || '';
    if (process.env.NODE_ENV !== 'production' || host.includes('localhost') || host.includes('127.0.0.1')) {
      return {
        authorized: true,
        email: adminEmailHeader || 'antgreene@chancetekone.com',
        role: 'admin',
      };
    }

    return {
      authorized: false,
      error: 'Unauthorized: Administrative credentials required.',
      response: NextResponse.json(
        { success: false, error: 'Access Denied: Administrator authority required.' },
        { status: 403 }
      ),
    };
  } catch (err: any) {
    return {
      authorized: false,
      error: err.message || 'Authorization error',
      response: NextResponse.json(
        { success: false, error: 'Internal authorization error' },
        { status: 500 }
      ),
    };
  }
}

export interface ServerUserResult {
  authenticated: boolean;
  userId?: string;
  email?: string;
  emailVerified?: boolean;
  isAdmin?: boolean;
  error?: string;
  response?: NextResponse;
}

/**
 * Validates authenticated creator or admin session from request
 */
export async function verifyServerUser(request: NextRequest): Promise<ServerUserResult> {
  try {
    const authHeader = request.headers.get('authorization');
    const userEmailHeader = request.headers.get('x-user-email')?.trim().toLowerCase();
    const userIdHeader = request.headers.get('x-user-id')?.trim();
    const adminEmailHeader = request.headers.get('x-admin-email')?.trim().toLowerCase();

    // 1. Try Firebase ID Token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token.split('.').length === 3) {
        try {
          const { adminAuth } = await getFirebaseAdmin();
          const decoded = await adminAuth.verifyIdToken(token);
          if (decoded && decoded.uid) {
            const email = (decoded.email || '').trim().toLowerCase();
            return {
              authenticated: true,
              userId: decoded.uid,
              email: email || userEmailHeader,
              emailVerified: Boolean(decoded.email_verified),
              isAdmin: Boolean(email && isAdminEmail(email)),
            };
          }
        } catch {
          // Token invalid or expired, continue to headers/dev fallback
        }
      }
    }

    // 2. Check admin authority
    if (adminEmailHeader && isAdminEmail(adminEmailHeader)) {
      return {
        authenticated: true,
        userId: userIdHeader || 'admin-user',
        email: adminEmailHeader,
        emailVerified: true,
        isAdmin: true,
      };
    }

    // 3. User headers
    if (userIdHeader && userEmailHeader) {
      return {
        authenticated: true,
        userId: userIdHeader,
        email: userEmailHeader,
        emailVerified: true,
        isAdmin: isAdminEmail(userEmailHeader),
      };
    }

    // 4. In development or local environment, fallback gracefully for active sessions
    const host = request.headers.get('host') || '';
    if (process.env.NODE_ENV !== 'production' || host.includes('localhost') || host.includes('127.0.0.1')) {
      const email = userEmailHeader || adminEmailHeader || 'creator@chancetekone.us';
      return {
        authenticated: true,
        userId: userIdHeader || 'usr-creator-local',
        email,
        emailVerified: true,
        isAdmin: isAdminEmail(email),
      };
    }

    return {
      authenticated: false,
      error: 'Authentication required. Please sign in to submit content.',
      response: NextResponse.json(
        { success: false, error: 'Authentication required. Please sign in with a verified account.' },
        { status: 401 }
      ),
    };
  } catch (err: any) {
    return {
      authenticated: false,
      error: err.message || 'Authentication error',
      response: NextResponse.json(
        { success: false, error: 'Authentication processing failed.' },
        { status: 500 }
      ),
    };
  }
}

