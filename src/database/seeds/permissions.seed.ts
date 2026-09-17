import { DataSource } from 'typeorm';
import { Permission } from '../../modules/users/entities/permission.entity';

export interface PermissionDefinition {
  code: string;
  module: string;
  action: string;
  description: string;
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // Cars
  { code: 'cars.view',          module: 'cars',      action: 'view',          description: 'View car listings' },
  { code: 'cars.create',        module: 'cars',      action: 'create',        description: 'Create new car listings' },
  { code: 'cars.update',        module: 'cars',      action: 'update',        description: 'Update existing car listings' },
  { code: 'cars.delete',        module: 'cars',      action: 'delete',        description: 'Delete car listings' },
  { code: 'cars.status.update', module: 'cars',      action: 'status.update', description: 'Change car listing status' },

  // Catalog
  { code: 'catalog.view',   module: 'catalog', action: 'view',   description: 'View brands and models' },
  { code: 'catalog.create', module: 'catalog', action: 'create', description: 'Create brands and models' },
  { code: 'catalog.update', module: 'catalog', action: 'update', description: 'Update brands and models' },
  { code: 'catalog.delete', module: 'catalog', action: 'delete', description: 'Delete brands and models' },

  // Leads
  { code: 'leads.view',   module: 'leads', action: 'view',   description: 'View buy-my-car leads' },
  { code: 'leads.create', module: 'leads', action: 'create', description: 'Create leads' },
  { code: 'leads.update', module: 'leads', action: 'update', description: 'Update leads' },
  { code: 'leads.assign', module: 'leads', action: 'assign', description: 'Assign leads to staff' },
  { code: 'leads.export', module: 'leads', action: 'export', description: 'Export leads to CSV/Excel' },

  // Inquiries
  { code: 'inquiries.view',   module: 'inquiries', action: 'view',   description: 'View customer inquiries' },
  { code: 'inquiries.create', module: 'inquiries', action: 'create', description: 'Create inquiries' },
  { code: 'inquiries.update', module: 'inquiries', action: 'update', description: 'Update inquiries' },
  { code: 'inquiries.assign', module: 'inquiries', action: 'assign', description: 'Assign inquiries to staff' },

  // CMS
  { code: 'cms.view',   module: 'cms', action: 'view',   description: 'View CMS content' },
  { code: 'cms.create', module: 'cms', action: 'create', description: 'Create CMS content' },
  { code: 'cms.update', module: 'cms', action: 'update', description: 'Update CMS content' },
  { code: 'cms.delete', module: 'cms', action: 'delete', description: 'Delete CMS content' },

  // Dashboard
  { code: 'dashboard.view', module: 'dashboard', action: 'view', description: 'Access the admin dashboard' },

  // Reports
  { code: 'reports.view',   module: 'reports', action: 'view',   description: 'View reports and analytics' },
  { code: 'reports.export', module: 'reports', action: 'export', description: 'Export reports' },

  // Users
  { code: 'users.view',   module: 'users', action: 'view',   description: 'View system users' },
  { code: 'users.create', module: 'users', action: 'create', description: 'Create system users' },
  { code: 'users.update', module: 'users', action: 'update', description: 'Update system users' },
  { code: 'users.delete', module: 'users', action: 'delete', description: 'Delete system users' },

  // Roles
  { code: 'roles.view', module: 'roles', action: 'view', description: 'View roles and permissions' },

  // Audit
  { code: 'audit.view', module: 'audit', action: 'view', description: 'View activity audit logs' },
];

/**
 * Upserts all permissions into the database.
 * On conflict on `code`, updates the description only.
 */
export async function seedPermissions(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(Permission);

  for (const def of ALL_PERMISSIONS) {
    await repo
      .createQueryBuilder()
      .insert()
      .into(Permission)
      .values(def)
      .orUpdate(['description'], ['code'])
      .execute();
  }

  console.log(`✅ Seeded ${ALL_PERMISSIONS.length} permissions`);
}
