import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../constants/app.constants';

/**
 * Attach required permission strings to a route or controller.
 * The PermissionsGuard will enforce that the authenticated user holds ALL listed permissions.
 *
 * @example
 * @RequirePermissions('cars:write', 'cars:publish')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
