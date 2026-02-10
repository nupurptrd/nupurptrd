/**
 * @file Global HTTP Exception Filter
 * @description Production-grade exception filter for standardized error responses
 *
 * Features:
 * - Standardized error response format
 * - Correlation ID tracking for request tracing
 * - Detailed error logging
 * - Environment-aware stack trace handling
 * - Support for validation errors with field-level details
 *
 * @example
 * Response format:
 * ```json
 * {
 *   "statusCode": 400,
 *   "error": "Bad Request",
 *   "message": "Validation failed",
 *   "details": [
 *     { "field": "email", "message": "Invalid email format" }
 *   ],
 *   "correlationId": "abc123",
 *   "timestamp": "2026-01-26T10:00:00.000Z",
 *   "path": "/api/users"
 * }
 * ```
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Validation error detail structure
 */
interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Standardized error response structure
 */
interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: ValidationErrorDetail[];
  correlationId: string;
  timestamp: string;
  path: string;
  stack?: string;
}

/**
 * HTTP status code to error name mapping
 */
const HTTP_STATUS_NAMES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

/**
 * Global HTTP Exception Filter
 *
 * Catches all HTTP exceptions and formats them into a standardized response.
 * Automatically generates correlation IDs for request tracing.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  /**
   * Handle exception and send standardized response
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Generate or use existing correlation ID
    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      (request.headers['x-request-id'] as string) ||
      uuidv4();

    // Determine status code and message
    const { statusCode, message, details } =
      this.extractErrorDetails(exception);

    // Get error name from status code
    const errorName = HTTP_STATUS_NAMES[statusCode] || 'Error';

    // Build error response
    const errorResponse: ErrorResponse = {
      statusCode,
      error: errorName,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Add validation details if present
    if (details && details.length > 0) {
      errorResponse.details = details;
    }

    // Add stack trace in development
    if (!this.isProduction && exception instanceof Error) {
      errorResponse.stack = exception.stack;
    }

    // Log the error
    this.logError(exception, errorResponse, request);

    // Set correlation ID header for client tracking
    response.setHeader('X-Correlation-ID', correlationId);

    // Send response
    response.status(statusCode).json(errorResponse);
  }

  /**
   * Extract error details from exception
   */
  private extractErrorDetails(exception: unknown): {
    statusCode: number;
    message: string;
    details?: ValidationErrorDetail[];
  } {
    // Handle HttpException
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Handle validation errors from class-validator
      if (
        exception instanceof BadRequestException &&
        typeof exceptionResponse === 'object'
      ) {
        const response = exceptionResponse as Record<string, unknown>;

        // Check for class-validator format
        if (Array.isArray(response['message'])) {
          const details = this.parseValidationErrors(
            response['message'] as string[],
          );
          return {
            statusCode,
            message: 'Validation failed',
            details,
          };
        }
      }

      // Standard HttpException
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : ((exceptionResponse as Record<string, unknown>)[
              'message'
            ] as string) || exception.message;

      return { statusCode, message };
    }

    // Handle TypeORM errors
    if (exception instanceof Error && exception.name === 'QueryFailedError') {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Database operation failed',
      };
    }

    // Handle unknown errors
    if (exception instanceof Error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: this.isProduction
          ? 'An unexpected error occurred'
          : exception.message,
      };
    }

    // Fallback for non-Error exceptions
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
    };
  }

  /**
   * Parse class-validator error messages into structured format
   */
  private parseValidationErrors(messages: string[]): ValidationErrorDetail[] {
    return messages.map((message) => {
      // Try to extract field name from validation message
      // Format: "fieldName should be ..." or "fieldName must be ..."
      const match = message.match(/^(\w+)\s+(should|must|is)/i);

      return {
        field: match ? match[1] : 'unknown',
        message,
      };
    });
  }

  /**
   * Log error with appropriate level based on status code
   */
  private logError(
    exception: unknown,
    errorResponse: ErrorResponse,
    request: Request,
  ): void {
    const reqWithUser = request as unknown as { user?: { id?: string } };
    const logContext = {
      correlationId: errorResponse.correlationId,
      method: request.method,
      url: request.url,
      statusCode: errorResponse.statusCode,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      userId: reqWithUser.user?.id,
    };

    const logMessage = `[${errorResponse.correlationId}] ${request.method} ${request.url} - ${errorResponse.statusCode} ${errorResponse.error}`;

    // Log based on status code severity
    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        logMessage,
        exception instanceof Error ? exception.stack : undefined,
        logContext,
      );
    } else if (errorResponse.statusCode >= 400) {
      this.logger.warn(logMessage, logContext);
    } else {
      this.logger.log(logMessage, logContext);
    }
  }
}
