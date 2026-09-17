import { DataSource } from 'typeorm';
import { Role } from '../../modules/users/entities/role.entity';
import { Permission } from '../../modules/users/entities/permission.entity';
import { ALL_PERMISSIONS } from './permissions.seed';
import type { RoleCode } from '../../modules/users/entities/role.entity';

interface RoleDefinition {
  code: RoleCode;
  name: string;
  description: string;
  isSystem: boolean;
  /** Permission codes assigned to this role. '*' means all permissions. */
  permissionCodes: string[] | ['*'];
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    code: 'SUPER_ADMIN',
    name: 'Super Administrator',
    description: 'Full access to all modules and settings',
    isSystem: true,
    permissionCodes: ['*'],
  },
  {
    code: 'SALES_STAFF',
    name: 'Sales Staff',
    description: 'Access to leads, inquiries, and car listings view',
    isSystem: true,
    permissionCodes: [
      'leads.view',
      'leads.create',
      'leads.update',
      'leads.assign',
      'leads.export',
      'inquiries.view',
      'inquiries.create',
      'inquiries.update',
      'inquiries.assign',
      'cars.view',
      'catalog.view',
      'dashboard.view',
    ],
  },
  {
    code: 'CONTENT_EDITOR',
    name: 'Content Editor',
    description: 'Manage CMS content, catalog, and view car listings',
    isSystem: true,
    permissionCodes: [
      'cms.view',
      'cms.create',
      'cms.update',
      'cms.delete',
      'catalog.view',
      'catalog.create',
      'catalog.update',
      'catalog.delete',
      'cars.view',
      'dashboard.view',
    ],
  },
  {
    code: 'VIEWER',
    name: 'Viewer',
    description: 'Read-only access to key modules',
    isSystem: true,
    permissionCodes: [
      'cars.view',
      'catalog.view',
      'leads.view',
      'inquiries.view',
      'dashboard.view',
    ],
  },
];

/**
 * Upserts all roles and assigns their permissions.
 * Safe to run multiple times — existing roles are updated in place.
 */
export async function seedRoles(dataSource: DataSource): Promise<void> {
  const roleRepo = dataSource.getRepository(Role);
  const permRepo = dataSource.getRepository(Permission);

  // Load all permissions once
  const allPermissions = await permRepo.find();
  const permissionMap = new Map<string, Permission>(allPermissions.map((p) => [p.code, p]));

  for (const def of ROLE_DEFINITIONS) {
    let role = await roleRepo.findOne({ where: { code: def.code }, relations: ['permissions'] });

    if (!role) {
      role = roleRepo.create();
    }

    role.code = def.code;
    role.name = def.name;
    role.description = def.description;
    role.isSystem = def.isSystem;

    if (def.permissionCodes[0] === '*') {
      role.permissions = allPermissions;
    } else {
      const codes = def.permissionCodes as string[];
      role.permissions = codes
        .map((code) => permissionMap.get(code))
        .filter((p): p is Permission => p !== undefined);
    }

    await roleRepo.save(role);
    console.log(`✅ Seeded role: ${def.code} (${role.permissions.length} permissions)`);
  }

  // Validate SUPER_ADMIN has all permissions
  const allCodes = ALL_PERMISSIONS.map((p) => p.code);
  const superAdminRole = await roleRepo.findOne({
    where: { code: 'SUPER_ADMIN' },
    relations: ['permissions'],
  });
  if (superAdminRole) {
    const missingCodes = allCodes.filter(
      (c) => !superAdminRole.permissions.some((p) => p.code === c),
    );
    if (missingCodes.length > 0) {
      console.warn(`⚠️  SUPER_ADMIN is missing permissions: ${missingCodes.join(', ')}`);
    }
  }
}
