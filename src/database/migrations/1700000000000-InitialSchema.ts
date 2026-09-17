import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1700000000000 implements MigrationInterface {
  name = "InitialSchema1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // permissions
    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" VARCHAR(100) NOT NULL UNIQUE,
        "module" VARCHAR(50) NOT NULL,
        "action" VARCHAR(50) NOT NULL,
        "description" VARCHAR(500) NOT NULL DEFAULT '',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_permissions_module_action" ON "permissions"("module", "action")`,
    );

    // roles
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(100) NOT NULL,
        "code" VARCHAR(50) NOT NULL UNIQUE,
        "description" VARCHAR(500) NOT NULL DEFAULT '',
        "is_system" BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // role_permissions
    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "role_id" UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
        "permission_id" UUID NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
        PRIMARY KEY ("role_id", "permission_id")
      )
    `);

    // users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" VARCHAR(255) NOT NULL,
        "username" VARCHAR(50) NOT NULL,
        "password_hash" VARCHAR(255) NOT NULL,
        "full_name" VARCHAR(150) NOT NULL,
        "role_id" UUID NOT NULL REFERENCES "roles"("id"),
        "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        "avatar_url" VARCHAR,
        "phone" VARCHAR(30),
        "last_login_at" TIMESTAMPTZ,
        "token_version" INT NOT NULL DEFAULT 0,
        "deleted_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_email_unique" ON "users"("email") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_username_unique" ON "users"("username") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_users_status" ON "users"("status")`,
    );

    // refresh_tokens
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "family_id" VARCHAR NOT NULL,
        "token_hash" VARCHAR(255) NOT NULL UNIQUE,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "revoked_at" TIMESTAMPTZ,
        "replaced_by_id" VARCHAR,
        "user_agent" VARCHAR(500),
        "ip_hash" VARCHAR(64),
        "device_id" VARCHAR(255),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_family" ON "refresh_tokens"("family_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_expires" ON "refresh_tokens"("expires_at")`,
    );

    // login_otp_tokens
    await queryRunner.query(`
      CREATE TABLE "login_otp_tokens" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "code_hash" VARCHAR(255) NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "attempts" INT NOT NULL DEFAULT 0,
        "used_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "login_otp_tokens_user_active" ON "login_otp_tokens"("user_id", "used_at", "expires_at")`,
    );

    // password_reset_tokens
    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_hash" VARCHAR(255) NOT NULL UNIQUE,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "used_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // brands
    await queryRunner.query(`
      CREATE TABLE "brands" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(100) NOT NULL,
        "slug" VARCHAR(100) NOT NULL UNIQUE,
        "logo_public_id" VARCHAR,
        "logo_url" VARCHAR,
        "description" TEXT,
        "sort_order" INT NOT NULL DEFAULT 0,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "deleted_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_brands_active_sort" ON "brands"("is_active", "sort_order")`,
    );

    // vehicle_models
    await queryRunner.query(`
      CREATE TABLE "vehicle_models" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "brand_id" UUID NOT NULL REFERENCES "brands"("id") ON DELETE CASCADE,
        "name" VARCHAR(100) NOT NULL,
        "slug" VARCHAR(100) NOT NULL,
        "variants" TEXT,
        "description" TEXT,
        "spec_template" TEXT,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "deleted_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "vehicle_models_brand_slug" ON "vehicle_models"("brand_id", "slug") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_vehicle_models_brand_active" ON "vehicle_models"("brand_id", "is_active")`,
    );

    // cars
    await queryRunner.query(`
      CREATE TABLE "cars" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "stock_no" VARCHAR(50),
        "slug" VARCHAR(200),
        "brand_id" VARCHAR NOT NULL,
        "model_id" VARCHAR NOT NULL,
        "variant" VARCHAR(100) NOT NULL DEFAULT '',
        "year" INT NOT NULL,
        "price_cents" BIGINT NOT NULL,
        "currency" VARCHAR(10) NOT NULL DEFAULT 'SGD',
        "coe_cents" BIGINT,
        "omv_cents" BIGINT,
        "arf_cents" BIGINT,
        "engine_cc" INT,
        "power_kw" FLOAT,
        "fuel_type" VARCHAR(50),
        "transmission" VARCHAR(50),
        "seats" INT,
        "mileage_km" INT,
        "colors" TEXT,
        "features" TEXT,
        "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        "is_hidden" BOOLEAN NOT NULL DEFAULT FALSE,
        "is_featured" BOOLEAN NOT NULL DEFAULT FALSE,
        "published_at" TIMESTAMPTZ,
        "description" TEXT,
        "seo_title" VARCHAR(200),
        "seo_description" VARCHAR(500),
        "created_by" UUID REFERENCES "users"("id"),
        "updated_by" UUID REFERENCES "users"("id"),
        "deleted_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "cars_stock_no_unique" ON "cars"("stock_no") WHERE "deleted_at" IS NULL AND "stock_no" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "cars_slug_unique" ON "cars"("slug") WHERE "deleted_at" IS NULL AND "slug" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_cars_status" ON "cars"("status", "is_hidden", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_cars_brand_model" ON "cars"("brand_id", "model_id", "year")`,
    );

    // car_images
    await queryRunner.query(`
      CREATE TABLE "car_images" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "car_id" UUID NOT NULL REFERENCES "cars"("id") ON DELETE CASCADE,
        "public_id" VARCHAR NOT NULL,
        "url" VARCHAR NOT NULL,
        "secure_url" VARCHAR NOT NULL,
        "alt_text" VARCHAR(200),
        "width" INT,
        "height" INT,
        "bytes" INT,
        "mime_type" VARCHAR(50),
        "position" INT NOT NULL DEFAULT 0,
        "is_cover" BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // leads
    await queryRunner.query(`
      CREATE TABLE "leads" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "reference_no" VARCHAR(50) NOT NULL UNIQUE,
        "car_info" TEXT,
        "contact" TEXT,
        "images" TEXT,
        "source" VARCHAR(50),
        "status" VARCHAR(20) NOT NULL DEFAULT 'NEW',
        "assigned_to" UUID REFERENCES "users"("id"),
        "quoted_price_cents" BIGINT,
        "notes" TEXT DEFAULT '[]',
        "communications" TEXT DEFAULT '[]',
        "status_history" TEXT DEFAULT '[]',
        "next_follow_up_at" TIMESTAMPTZ,
        "completed_at" TIMESTAMPTZ,
        "deleted_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_leads_status" ON "leads"("status", "created_at")`,
    );

    // inquiries
    await queryRunner.query(`
      CREATE TABLE "inquiries" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "reference_no" VARCHAR(50) NOT NULL UNIQUE,
        "type" VARCHAR(30) NOT NULL,
        "car_id" UUID REFERENCES "cars"("id"),
        "contact" TEXT,
        "preferred_date" TIMESTAMPTZ,
        "status" VARCHAR(30) NOT NULL DEFAULT 'NEW',
        "assigned_to" UUID REFERENCES "users"("id"),
        "notes" TEXT DEFAULT '[]',
        "status_history" TEXT DEFAULT '[]',
        "deleted_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // content_pages
    await queryRunner.query(`
      CREATE TABLE "content_pages" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "key" VARCHAR(100) NOT NULL UNIQUE,
        "title" VARCHAR(200) NOT NULL,
        "blocks" TEXT,
        "version" INT NOT NULL DEFAULT 1,
        "is_published" BOOLEAN NOT NULL DEFAULT FALSE,
        "published_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // showrooms
    await queryRunner.query(`
      CREATE TABLE "showrooms" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(100) NOT NULL,
        "address" TEXT NOT NULL,
        "lat" FLOAT,
        "lng" FLOAT,
        "phone" VARCHAR(30),
        "email" VARCHAR(100),
        "opening_hours" TEXT,
        "images" TEXT,
        "sort_order" INT NOT NULL DEFAULT 0,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "deleted_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // team_members
    await queryRunner.query(`
      CREATE TABLE "team_members" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(100) NOT NULL,
        "job_title" VARCHAR(100) NOT NULL,
        "bio" TEXT,
        "avatar_public_id" VARCHAR,
        "avatar_url" VARCHAR,
        "phone" VARCHAR(30),
        "email" VARCHAR(100),
        "sort_order" INT NOT NULL DEFAULT 0,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "deleted_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // faqs
    await queryRunner.query(`
      CREATE TABLE "faqs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "category" VARCHAR(100),
        "question" TEXT NOT NULL,
        "answer" TEXT NOT NULL,
        "sort_order" INT NOT NULL DEFAULT 0,
        "is_published" BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // blog_posts
    await queryRunner.query(`
      CREATE TABLE "blog_posts" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" VARCHAR(200) NOT NULL,
        "slug" VARCHAR(200) NOT NULL UNIQUE,
        "content" TEXT NOT NULL,
        "excerpt" TEXT,
        "cover_public_id" VARCHAR,
        "cover_url" VARCHAR,
        "category" VARCHAR(100),
        "tags" TEXT,
        "author_id" UUID REFERENCES "users"("id"),
        "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        "seo_title" VARCHAR(200),
        "seo_description" VARCHAR(500),
        "published_at" TIMESTAMPTZ,
        "deleted_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // activity_logs
    await queryRunner.query(`
      CREATE TABLE "activity_logs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "actor" TEXT,
        "action" VARCHAR(100) NOT NULL,
        "module" VARCHAR(50) NOT NULL,
        "entity_id" VARCHAR,
        "diff" TEXT,
        "request_id" VARCHAR,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_activity_logs_module" ON "activity_logs"("module", "action", "created_at")`,
    );

    // report_jobs
    await queryRunner.query(`
      CREATE TABLE "report_jobs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" VARCHAR(50) NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        "filters" TEXT,
        "file_url" VARCHAR,
        "error_message" TEXT,
        "created_by" VARCHAR(36) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "report_jobs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_logs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blog_posts" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "faqs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_members" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "showrooms" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "content_pages" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inquiries" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "leads" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "car_images" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cars" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vehicle_models" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "brands" CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "password_reset_tokens" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "login_otp_tokens" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions" CASCADE`);
  }
}
