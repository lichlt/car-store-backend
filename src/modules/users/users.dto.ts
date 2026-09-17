import {
  IsEmail,
  IsString,
  MinLength,
  IsUUID,
  IsOptional,
  MaxLength,
  IsEnum,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType, OmitType } from '@nestjs/mapped-types';

import { PaginationDto } from '../../common/dto/pagination.dto';

import { UserStatus } from './entities/user.entity';

// ──────────────────────────────────────────────────────────────────────────────
// DTOs
// ──────────────────────────────────────────────────────────────────────────────

export class ListUsersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: UserStatus, description: 'Filter by account status' })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Filter by role UUID' })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional({ description: 'Full-text search on name / email / username' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'admin@carstore.vn' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'admin01' })
  @IsString()
  @MinLength(3)
  username!: string;

  @ApiProperty({ example: 'P@ssw0rd123', description: 'Plain-text password (min 8 chars)' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  fullName!: string;

  @ApiProperty({ description: 'UUID of the role to assign' })
  @IsUUID()
  roleId!: string;

  @ApiPropertyOptional({ example: '+84912345678' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

// OmitType removes 'password' from CreateUserDto before making everything optional
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {
  @ApiPropertyOptional({ description: 'URL of the user\'s avatar image' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiPropertyOptional({ enum: UserStatus, description: 'Account status' })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class UpdateRoleDto {
  @ApiProperty({ description: 'UUID of the new role to assign' })
  @IsUUID()
  roleId!: string;
}
