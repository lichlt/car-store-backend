import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { REQUEST_ID_HEADER } from '../constants/app.constants';

interface RequestWithId extends Request {
  requestId?: string;
}

/**
 * Generates a unique request ID via `crypto.randomUUID()` and:
 *  - attaches it to `request.requestId` for downstream use (filters, interceptors)
 *  - sets the `X-Request-Id` response header
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();

    const requestId =
      (request.headers[REQUEST_ID_HEADER] as string | undefined) ??
      crypto.randomUUID();

    request.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);

    return next.handle();
  }
}
