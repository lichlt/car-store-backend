import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ──────────────────────────────────────────────────────────────────────────────
// Brand DTOs
// ──────────────────────────────────────────────────────────────────────────────

export class CreateBrandDto {
  @ApiProperty({ description: 'Brand name', maxLength: 100, example: 'Toyota' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Brand URL slug', maxLength: 100, example: 'toyota' })
  @IsString()
  @MaxLength(100)
  slug: string;

  @ApiPropertyOptional({ description: 'Brand description', example: 'Japanese multinational automotive manufacturer' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Display sort order', default: 0, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Active status', default: true, example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBrandDto extends PartialType(CreateBrandDto) {}

export class ListBrandsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by active status', example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// VehicleModel DTOs
// ──────────────────────────────────────────────────────────────────────────────

export class CreateVehicleModelDto {
  @ApiProperty({ description: 'Associated Brand UUID', example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsUUID()
  brandId: string;

  @ApiProperty({ description: 'Model name', maxLength: 100, example: 'Corolla' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Model URL slug', maxLength: 100, example: 'corolla' })
  @IsString()
  @MaxLength(100)
  slug: string;

  @ApiPropertyOptional({
    description: 'List of model variants/trims',
    type: [String],
    example: ['1.8 Altis Elegance', '2.0 Hybrid'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variants?: string[];

  @ApiPropertyOptional({ description: 'Model description', example: 'Compact sedan with high fuel efficiency' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Active status', default: true, example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateVehicleModelDto extends PartialType(CreateVehicleModelDto) {}

export class ListModelsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by Brand UUID' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ description: 'Filter by active status', example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;
}
