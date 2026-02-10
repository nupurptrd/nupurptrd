/**
 * @file Common Type Definitions
 * @description Shared types used across the application
 */

import { Request } from 'express';

/**
 * JWT Payload structure after validation
 */
export interface JwtPayload {
  id: string;
  userId?: string;
  email?: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

/**
 * Authenticated request with user information from JWT
 * Used in controllers that require authentication
 */
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

/**
 * Optional authenticated request where user may or may not be present
 * Used in endpoints that support both authenticated and anonymous access
 */
export interface OptionalAuthRequest extends Request {
  user?: JwtPayload;
}
