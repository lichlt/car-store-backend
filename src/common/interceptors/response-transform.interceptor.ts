import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface RequestWithId extends Request {
  requestId?: string;
}

interface PaginatedShape<T> {
  data: T[];
  meta: Record<string, unknown>;
}

interface WrappedResponse<T> {
  data: T | PaginatedShape<T>;
  requestId: string | undefined;
}

function isPaginatedShape(value: unknown): value is PaginatedShape<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'data' in value &&
    'meta' in value &&
    Array.isArray((value as PaginatedShape<unknown>).data)
  );
}

/**
 * Wraps every successful response in:
 *   { data: <original>, requestId: "<id>" }
 *
 * Paginated responses (shape `{ data: [], meta: {} }`) are passed through as
 * the `data` property so the envelope stays consistent.
 */
@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, WrappedResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<WrappedResponse<T>> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithId>();

    return next.handle().pipe(
      map((response) => ({
        data: isPaginatedShape(response) ? response : response,
        requestId: request.requestId,
      })),
    );
  }
}
