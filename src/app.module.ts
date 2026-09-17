import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { validate } from "./config/env.validation";
import { databaseConfig } from "./config/database.config";
import { HealthModule } from "./modules/health/health.module";

/**
 * Feature modules are imported below as they are implemented.
 * Placeholder imports are commented out so the app compiles while
 * those modules are scaffolded in later steps.
 */
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { CarsModule } from "./modules/cars/cars.module";
import { LeadsModule } from "./modules/leads/leads.module";
import { InquiriesModule } from "./modules/inquiries/inquiries.module";
import { CmsModule } from "./modules/cms/cms.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { AuditModule } from "./modules/audit/audit.module";
import { RedisModule } from "./modules/redis/redis.module";

@Module({
  imports: [
    // Config — must be first so other modules can inject ConfigService
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: [".env", ".env.local"],
    }),

    // Database
    TypeOrmModule.forRootAsync(databaseConfig),

    // Feature modules
    HealthModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    CarsModule,
    LeadsModule,
    InquiriesModule,
    CmsModule,
    DashboardModule,
    ReportsModule,
    AuditModule,
    RedisModule,
  ],
})
export class AppModule {}
