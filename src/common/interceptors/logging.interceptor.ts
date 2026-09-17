import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

interface RequestWithId extends Request {
  requestId?: string;
}

/**
 * Logs incoming request method/url and the outgoing status/duration.
 * Deliberately excludes request body and headers to avoid logging PII.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const { method, url, requestId } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.logger.log(
            `${method} ${url} ${response.statusCode} ${duration}ms [${requestId ?? '-'}]`,
          );
        },
        error: () => {
          const duration = Date.now() - start;
          // Status code is not yet set when an exception is thrown;
          // the AllExceptionsFilter handles status assignment.
          this.logger.warn(
            `${method} ${url} ERR ${duration}ms [${requestId ?? '-'}]`,
          );
        },
      }),
    );
  }
}
