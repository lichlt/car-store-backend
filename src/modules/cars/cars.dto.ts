import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CarStatus } from './entities/car.entity';

export enum CarSortField {
  CREATED_AT = 'createdAt',
  PRICE_CENTS = 'priceCents',
  YEAR = 'year',
}

export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

// ──────────────────────────────────────────────────────────────────────────────
// ListCarsDto
// ──────────────────────────────────────────────────────────────────────────────

export class ListCarsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CarStatus, description: 'Filter by car status' })
  @IsOptional()
  @IsEnum(CarStatus)
  status?: CarStatus;

  @ApiPropertyOptional({ description: 'Filter by Brand UUID' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ description: 'Filter by VehicleModel UUID' })
  @IsOptional()
  @IsUUID()
  modelId?: string;

  @ApiPropertyOptional({ description: 'Minimum price in cents' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price in cents' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Manufacturing/model year' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ApiPropertyOptional({ description: 'Search term across variant, description, stockNo' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by featured flag' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: 'Filter by hidden flag' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isHidden?: boolean;

  @ApiPropertyOptional({ enum: CarSortField, description: 'Sort field' })
  @IsOptional()
  @IsEnum(CarSortField)
  sort?: CarSortField;

  @ApiPropertyOptional({ enum: SortDirection, description: 'Sort direction (ASC/DESC)' })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: SortDirection;
}

// ──────────────────────────────────────────────────────────────────────────────
// CreateCarDto
// ──────────────────────────────────────────────────────────────────────────────

export class CreateCarDto {
  @ApiProperty({ description: 'Brand UUID', example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsUUID()
  brandId: string;

  @ApiProperty({ description: 'VehicleModel UUID', example: 'b1ffcd00-0d1c-4ef9-cc7e-7cc0ce491b22' })
  @IsUUID()
  modelId: string;

  @ApiPropertyOptional({ description: 'Variant/trim specification', example: '1.8 Altis Elegance' })
  @IsOptional()
  @IsString()
  variant?: string;

  @ApiProperty({ description: 'Manufacture/registration year', minimum: 1900, example: 2023 })
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  year: number;

  @ApiProperty({ description: 'Price in cents (string representation for bigint)', example: '12500000' })
  @IsString()
  priceCents: string;

  @ApiPropertyOptional({ description: 'Currency code', default: 'SGD', example: 'SGD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'COE price in cents (string representation)', example: '9500000' })
  @IsOptional()
  @IsString()
  coeCents?: string;

  @ApiPropertyOptional({ description: 'Open Market Value in cents', example: '2500000' })
  @IsOptional()
  @IsString()
  omvCents?: string;

  @ApiPropertyOptional({ description: 'Additional Registration Fee in cents', example: '2800000' })
  @IsOptional()
  @IsString()
  arfCents?: string;

  @ApiPropertyOptional({ description: 'Engine displacement in cubic centimeters (cc)', example: 1798 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  engineCc?: number;

  @ApiPropertyOptional({ description: 'Engine power in kilowatts (kW)', example: 95.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  powerKw?: number;

  @ApiPropertyOptional({ description: 'Fuel type (Petrol, Diesel, Hybrid, Electric)', example: 'Petrol' })
  @IsOptional()
  @IsString()
  fuelType?: string;

  @ApiPropertyOptional({ description: 'Transmission type (Automatic, Manual, CVT)', example: 'Automatic' })
  @IsOptional()
  @IsString()
  transmission?: string;

  @ApiPropertyOptional({ description: 'Number of seating capacity', example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seats?: number;

  @ApiPropertyOptional({ description: 'Mileage in kilometers', example: 15000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  mileageKm?: number;

  @ApiPropertyOptional({ description: 'Available colors', type: [String], example: ['White', 'Black'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  colors?: string[];

  @ApiPropertyOptional({ description: 'Vehicle features and accessories', type: [String], example: ['Keyless Go', 'Sunroof'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({ description: 'Detailed car description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'SEO title tag' })
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional({ description: 'SEO meta description' })
  @IsOptional()
  @IsString()
  seoDescription?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// UpdateCarDto
// ──────────────────────────────────────────────────────────────────────────────

export class UpdateCarDto extends PartialType(CreateCarDto) {
  @ApiPropertyOptional({ description: 'Unique inventory stock reference number', example: 'CS-2023-A8F2K' })
  @IsOptional()
  @IsString()
  stockNo?: string;

  @ApiPropertyOptional({ description: 'URL-friendly slug', example: 'toyota-corolla-altis-2023' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ description: 'Whether listing is hidden from public inventory', example: false })
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @ApiPropertyOptional({ description: 'Whether listing is featured on homepage', example: true })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Status & Featured DTOs
// ──────────────────────────────────────────────────────────────────────────────

export class UpdateCarStatusDto {
  @ApiProperty({ enum: CarStatus, description: 'Target car status', example: CarStatus.AVAILABLE })
  @IsEnum(CarStatus)
  status: CarStatus;

  @ApiPropertyOptional({ description: 'Reason for status update (required for SOLD -> RESERVED)', example: 'Customer financing rejected' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateCarFeaturedDto {
  @ApiProperty({ description: 'Featured listing status', example: true })
  @IsBoolean()
  isFeatured: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Image Management DTOs
// ──────────────────────────────────────────────────────────────────────────────

export class UpdateImageOrderDto {
  @ApiProperty({
    description: 'Ordered list of image UUIDs for the car',
    type: [String],
    example: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2ffcd00-0d1c-4ef9-cc7e-7cc0ce491b33'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  imageIds: string[];
}

export class UpdateCoverImageDto {
  @ApiProperty({ description: 'Image UUID to set as primary cover image' })
  @IsUUID()
  imageId: string;
}
