import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ValidationError } from 'class-validator';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details: string[];
  };
  requestId: string | undefined;
}

interface RequestWithId extends Request {
  requestId?: string;
}

/** PostgreSQL unique-violation error code */
const PG_UNIQUE_VIOLATION = '23505';

/**
 * Global exception filter that normalises all thrown errors into a consistent
 * JSON envelope and avoids leaking stack traces in production.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly isProduction: boolean;

  constructor(configService?: ConfigService) {
    this.isProduction =
      (configService?.get<string>('NODE_ENV') ?? process.env['NODE_ENV']) ===
      'production';
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    const requestId = request.requestId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: string[] = [];

    // ── HttpException (NestJS built-ins + custom) ──────────────────────────
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = typeof resp['message'] === 'string'
          ? resp['message']
          : Array.isArray(resp['message'])
            ? (resp['message'] as string[]).join('; ')
            : exception.message;

        if (Array.isArray(resp['message'])) {
          details = resp['message'] as string[];
        }
      }

      code = this.httpStatusToCode(status);
    }

    // ── TypeORM QueryFailedError ───────────────────────────────────────────
    else if (exception instanceof QueryFailedError) {
      const driverError = (exception as QueryFailedError & { driverError?: { code?: string } })
        .driverError;

      if (driverError?.code === PG_UNIQUE_VIOLATION) {
        status = HttpStatus.CONFLICT;
        code = 'CONFLICT';
        message = 'A record with the provided value already exists';
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        code = 'DATABASE_ERROR';
        message = 'A database error occurred';
      }

      if (!this.isProduction) {
        this.logger.error(
          `QueryFailedError: ${exception.message}`,
          exception.stack,
        );
      }
    }

    // ── class-validator ValidationError array ─────────────────────────────
    else if (
      Array.isArray(exception) &&
      exception.length > 0 &&
      exception[0] instanceof ValidationError
    ) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      code = 'VALIDATION_ERROR';
      message = 'Validation failed';
      details = this.flattenValidationErrors(exception as ValidationError[]);
    }

    // ── Unknown / generic Error ────────────────────────────────────────────
    else {
      if (!this.isProduction) {
        this.logger.error(
          exception instanceof Error ? exception.message : String(exception),
          exception instanceof Error ? exception.stack : undefined,
        );
      } else {
        this.logger.error('Unhandled exception occurred');
      }
    }

    const body: ErrorBody = {
      error: { code, message, details },
      requestId,
    };

    response.status(status).json(body);
  }

  private httpStatusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      405: 'METHOD_NOT_ALLOWED',
      409: 'CONFLICT',
      410: 'GONE',
      422: 'VALIDATION_ERROR',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };
    return map[status] ?? `HTTP_${status}`;
  }

  private flattenValidationErrors(errors: ValidationError[]): string[] {
    const messages: string[] = [];

    const extract = (err: ValidationError, prefix = ''): void => {
      const property = prefix ? `${prefix}.${err.property}` : err.property;

      if (err.constraints) {
        messages.push(...Object.values(err.constraints).map((c) => `${property}: ${c}`));
      }

      if (err.children && err.children.length > 0) {
        err.children.forEach((child) => extract(child, property));
      }
    };

    errors.forEach((err) => extract(err));
    return messages;
  }
}
