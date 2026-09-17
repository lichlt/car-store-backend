import {
  IsEmail,
  IsString,
  MinLength,
  IsUUID,
  Length,
  Matches,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ──────────────────────────────────────────────────────────────────────────────
// Auth DTOs
// ──────────────────────────────────────────────────────────────────────────────

export class LoginDto {
  @ApiProperty({ example: 'admin@carstore.vn', description: 'User email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'P@ssw0rd123', description: 'User password (min 8 chars)' })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ description: 'Challenge ID returned from /auth/login' })
  @IsUUID()
  challengeId!: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP code' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'otp must be exactly 6 digits' })
  otp!: string;
}

export class ResendOtpDto {
  @ApiProperty({ description: 'Challenge ID from the previous /auth/login call' })
  @IsUUID()
  challengeId!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'admin@carstore.vn', description: 'Registered email address' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Opaque reset token from the email link' })
  @IsString()
  token!: string;

  @ApiProperty({ example: 'NewP@ssw0rd!', description: 'New password (min 8 chars)' })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password for verification' })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ example: 'NewP@ssw0rd!', description: 'New password (min 8 chars)' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nguyen Van A', description: 'Display name' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: '+84912345678', description: 'Phone number (max 30 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
