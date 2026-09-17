import 'reflect-metadata';
import * as dotenv from 'dotenv';

dotenv.config();

import { AppDataSource } from '../data-source';
import { seedPermissions } from './permissions.seed';
import { seedRoles } from './roles.seed';
import { seedAdmin } from './admin.seed';

async function main(): Promise<void> {
  console.log('🌱 Initialising database connection…');
  await AppDataSource.initialize();
  console.log('✅ Connected to database\n');

  try {
    console.log('── Step 1/3: Seeding permissions ──');
    await seedPermissions(AppDataSource);

    console.log('\n── Step 2/3: Seeding roles ──');
    await seedRoles(AppDataSource);

    console.log('\n── Step 3/3: Seeding admin user ──');
    await seedAdmin(AppDataSource);

    console.log('\n🎉 All seeds completed successfully');
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await AppDataSource.destroy();
    console.log('🔌 Database connection closed');
  }
}

void main();
