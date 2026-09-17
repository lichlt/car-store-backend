import { DataSource } from 'typeorm';
import { User, UserStatus } from '../../modules/users/entities/user.entity';
import { Role } from '../../modules/users/entities/role.entity';

/**
 * Seeds the initial super-admin user from environment variables.
 *
 * Required env vars:
 *   SEED_ADMIN_EMAIL
 *   SEED_ADMIN_PASSWORD
 *   SEED_ADMIN_USERNAME
 *   SEED_ADMIN_FULL_NAME
 */
export async function seedAdmin(dataSource: DataSource): Promise<void> {
  const email    = process.env['SEED_ADMIN_EMAIL']     ?? 'admin@carstore.local';
  const password = process.env['SEED_ADMIN_PASSWORD']  ?? 'Admin@12345!';
  const username = process.env['SEED_ADMIN_USERNAME']  ?? 'superadmin';
  const fullName = process.env['SEED_ADMIN_FULL_NAME'] ?? 'Super Admin';

  const userRepo = dataSource.getRepository(User);
  const roleRepo = dataSource.getRepository(Role);

  const superAdminRole = await roleRepo.findOne({ where: { code: 'SUPER_ADMIN' } });
  if (!superAdminRole) {
    throw new Error('SUPER_ADMIN role not found — run seedRoles first');
  }

  const existing = await userRepo
    .createQueryBuilder('u')
    .where('u.email = :email OR u.username = :username', { email, username })
    .getOne();

  if (existing) {
    console.log(`ℹ️  Admin user already exists (${existing.email}), skipping creation`);
    return;
  }

  const admin = userRepo.create({
    email,
    username,
    passwordHash: password, // @BeforeInsert will hash this
    fullName,
    role: superAdminRole,
    status: UserStatus.ACTIVE,
  });

  await userRepo.save(admin);
  console.log(`✅ Created super-admin: ${email} / ${username}`);
}
