import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../constants/app.constants';
import { RequestUser } from '../types/jwt-payload.interface';

interface AuthenticatedRequest {
  user: RequestUser;
}

/**
 * Guard that enforces all permissions listed via @RequirePermissions() are
 * present on the authenticated user. Requires JwtAuthGuard to run first.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permissions required — allow through
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!user || !Array.isArray(user.permissions)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const hasAll = requiredPermissions.every((permission) =>
      user.permissions.includes(permission),
    );

    if (!hasAll) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
