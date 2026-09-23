import { plainToInstance } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from "class-validator";

enum Environment {
  Development = "development",
  Test = "test",
  Production = "production",
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 4000;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  @IsOptional()
  REDIS_URL?: string = "redis://localhost:6379";

  @IsString()
  @IsOptional()
  MOL_TOKEN_ENCRYPTION_SECRET?: string;

  @IsInt()
  @Min(60)
  @Max(86400)
  @IsOptional()
  MOL_TOKEN_DURATION_SECONDS?: number = 600;

  @IsString()
  @IsOptional()
  JWT_ACCESS_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET?: string;

  @IsString()
  @IsOptional()
  ACCESS_TOKEN_TTL?: string = "15m";

  @IsInt()
  @Min(1)
  @IsOptional()
  REFRESH_TOKEN_TTL_DAYS?: number = 7;

  @IsInt()
  @Min(1)
  @Max(30)
  @IsOptional()
  LOGIN_OTP_TTL_MINUTES?: number = 10;

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  LOGIN_OTP_MAX_ATTEMPTS?: number = 5;

  @IsString()
  @IsOptional()
  COOKIE_DOMAIN?: string;

  @IsString()
  @IsOptional()
  FRONTEND_URL?: string = 'http://localhost:3000';

  @IsString()
  @IsOptional()
  CLOUDINARY_CLOUD_NAME?: string;

  @IsString()
  @IsOptional()
  CLOUDINARY_API_KEY?: string;

  @IsString()
  @IsOptional()
  CLOUDINARY_API_SECRET?: string;

  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsInt()
  @IsOptional()
  SMTP_PORT?: number = 587;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASS?: string;

  @IsString()
  @IsOptional()
  MAIL_FROM?: string;

  @IsString()
  @IsOptional()
  LOG_LEVEL?: string = "info";

  @IsString()
  @IsOptional()
  SEED_ADMIN_EMAIL?: string;

  @IsString()
  @IsOptional()
  SEED_ADMIN_PASSWORD?: string;

  @IsString()
  @IsOptional()
  SEED_ADMIN_USERNAME?: string;

  @IsString()
  @IsOptional()
  SEED_ADMIN_FULL_NAME?: string;
}

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
