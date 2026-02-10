/**
 * @file Request Logging Middleware
 * @description Production-grade request/response logging middleware
 *
 * Features:
 * - Correlation ID generation and propagation
 * - Request/response timing
 * - Structured logging format
 * - Sensitive data masking
 * - Configurable log levels
 *
 * @example
 * Log output:
 * ```
 * [RequestLogger] [abc123] POST /api/auth/login - 200 OK (45ms)
 * ```
 */

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Extended Request with correlation ID
 */
export interface RequestWithCorrelation extends Request {
  correlationId: string;
  requestStartTime: number;
}

/**
 * Sensitive headers and body fields to mask in logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'authorization',
  'cookie',
  'secret',
  'apikey',
  'api_key',
  'access_token',
  'refresh_token',
];

/**
 * Paths to exclude from detailed logging
 */
const EXCLUDED_PATHS = ['/health', '/api/health', '/favicon.ico'];

/**
 * Request Logging Middleware
 *
 * Logs all incoming requests and outgoing responses with timing information.
 * Automatically generates and propagates correlation IDs for request tracing.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('RequestLogger');
  private readonly isProduction = process.env.NODE_ENV === 'production';

  /**
   * Middleware handler
   */
  use(req: RequestWithCorrelation, res: Response, next: NextFunction): void {
    // Skip excluded paths
    if (this.shouldSkipLogging(req.path)) {
      return next();
    }

    // Generate or extract correlation ID
    const correlationId = this.getCorrelationId(req);
    req.correlationId = correlationId;
    req.requestStartTime = Date.now();

    // Set correlation ID in response headers
    res.setHeader('X-Correlation-ID', correlationId);

    // Log incoming request
    this.logRequest(req);

    // Capture response
    const originalSend = res.send.bind(res);
    res.send = (body: unknown): Response => {
      this.logResponse(req, res);
      return originalSend(body);
    };

    next();
  }

  /**
   * Get or generate correlation ID
   */
  private getCorrelationId(req: Request): string {
    return (
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['x-request-id'] as string) ||
      uuidv4()
    );
  }

  /**
   * Check if path should be excluded from logging
   */
  private shouldSkipLogging(path: string): boolean {
    return EXCLUDED_PATHS.some((excluded) => path.startsWith(excluded));
  }

  /**
   * Log incoming request
   */
  private logRequest(req: RequestWithCorrelation): void {
    const { method, originalUrl, correlationId } = req;
    const reqWithUser = req as unknown as { user?: { id?: string } };

    const logData: Record<string, unknown> = {
      correlationId,
      method,
      url: originalUrl,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
    };

    // Add user ID if authenticated
    if (reqWithUser.user) {
      logData.userId = reqWithUser.user.id;
    }

    // Log query params (non-production only)
    if (!this.isProduction && Object.keys(req.query).length > 0) {
      logData.query = this.maskSensitiveData(req.query);
    }

    // Log body for mutations (non-production only)
    if (
      !this.isProduction &&
      ['POST', 'PUT', 'PATCH'].includes(method) &&
      req.body
    ) {
      logData.body = this.maskSensitiveData(req.body);
    }

    this.logger.log(
      `[${correlationId}] --> ${method} ${originalUrl}`,
      JSON.stringify(logData),
    );
  }

  /**
   * Log outgoing response
   */
  private logResponse(req: RequestWithCorrelation, res: Response): void {
    const { method, originalUrl, correlationId, requestStartTime } = req;
    const duration = Date.now() - requestStartTime;
    const { statusCode } = res;

    const logLevel = this.getLogLevel(statusCode);
    const statusText = this.getStatusText(statusCode);

    const message = `[${correlationId}] <-- ${method} ${originalUrl} - ${statusCode} ${statusText} (${duration}ms)`;

    const logData = {
      correlationId,
      method,
      url: originalUrl,
      statusCode,
      duration,
      contentLength: res.getHeader('content-length'),
    };

    switch (logLevel) {
      case 'error':
        this.logger.error(message, JSON.stringify(logData));
        break;
      case 'warn':
        this.logger.warn(message, JSON.stringify(logData));
        break;
      default:
        this.logger.log(message);
    }
  }

  /**
   * Get client IP address
   */
  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown'
    );
  }

  /**
   * Determine log level based on status code
   */
  private getLogLevel(statusCode: number): 'log' | 'warn' | 'error' {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'log';
  }

  /**
   * Get status text for common codes
   */
  private getStatusText(statusCode: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      301: 'Moved Permanently',
      302: 'Found',
      304: 'Not Modified',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };
    return statusTexts[statusCode] || '';
  }

  /**
   * Mask sensitive data in objects
   */
  private maskSensitiveData(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;

    const masked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(
      data as Record<string, unknown>,
    )) {
      const lowerKey = key.toLowerCase();

      if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field))) {
        masked[key] = '***REDACTED***';
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskSensitiveData(value);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }
}
