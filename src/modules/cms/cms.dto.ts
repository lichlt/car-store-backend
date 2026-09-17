import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { BlogStatus } from './entities/blog-post.entity';

// ─── Content Page DTOs ────────────────────────────────────────────────────────
export class CreateContentPageDto {
  @ApiProperty({ description: 'Unique page key identifier (e.g. about-us, warranty)', example: 'about-us' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ description: 'Page title', example: 'About Us' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Structured content blocks array', type: [Object], example: [{ type: 'hero', text: 'Welcome' }] })
  @IsArray()
  blocks: unknown[];

  @ApiPropertyOptional({ description: 'Whether page is published immediately', default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateContentPageDto {
  @ApiPropertyOptional({ description: 'Page title', example: 'About Our Dealership' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Structured content blocks array', type: [Object] })
  @IsOptional()
  @IsArray()
  blocks?: unknown[];

  @ApiPropertyOptional({ description: 'Publish status flag' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class ListContentPagesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search term for page title or key' })
  @IsOptional()
  @IsString()
  search?: string;
}

// ─── Showroom DTOs ────────────────────────────────────────────────────────────
export class CreateShowroomDto {
  @ApiProperty({ description: 'Showroom name', example: 'Central Flagship Showroom' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Physical address', example: '123 Leng Kee Road, Singapore 159090' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiPropertyOptional({ description: 'GPS Latitude', example: 1.2912 })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ description: 'GPS Longitude', example: 103.8118 })
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ description: 'Contact phone number', example: '+6567891234' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Contact email address', example: 'showroom@carstore.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Weekly opening hours map',
    example: { 'Mon-Fri': '09:00 - 19:00', 'Sat-Sun': '10:00 - 18:00' },
  })
  @IsOptional()
  @IsObject()
  openingHours?: Record<string, string>;

  @ApiPropertyOptional({ description: 'List of image URLs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ description: 'Display ordering priority', default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether showroom is currently active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateShowroomDto {
  @ApiPropertyOptional({ description: 'Showroom name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Physical address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'GPS Latitude' })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ description: 'GPS Longitude' })
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Contact email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Weekly opening hours map' })
  @IsOptional()
  @IsObject()
  openingHours?: Record<string, string>;

  @ApiPropertyOptional({ description: 'List of image URLs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ description: 'Display ordering priority' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether showroom is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListShowroomsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

// ─── Team Member DTOs ─────────────────────────────────────────────────────────
export class CreateTeamMemberDto {
  @ApiProperty({ description: 'Team member full name', example: 'Marcus Vance' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Job position / designation', example: 'Senior Sales Consultant' })
  @IsString()
  @IsNotEmpty()
  jobTitle: string;

  @ApiPropertyOptional({ description: 'Short professional biography' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ description: 'Cloudinary public ID for avatar' })
  @IsOptional()
  @IsString()
  avatarPublicId?: string;

  @ApiPropertyOptional({ description: 'Avatar image URL' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Direct contact phone' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Professional email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Display order priority', default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether member is active and visible', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTeamMemberDto {
  @ApiPropertyOptional({ description: 'Team member full name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Job position / designation' })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'Short biography' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ description: 'Cloudinary public ID' })
  @IsOptional()
  @IsString()
  avatarPublicId?: string;

  @ApiPropertyOptional({ description: 'Avatar image URL' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Direct contact phone' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Professional email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Display order priority' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListTeamMembersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

// ─── FAQ DTOs ─────────────────────────────────────────────────────────────────
export class CreateFaqDto {
  @ApiProperty({ description: 'FAQ Question', example: 'What documents are required to sell my car?' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ description: 'Detailed Answer text or markdown', example: 'You will need your NRIC, vehicle log card...' })
  @IsString()
  @IsNotEmpty()
  answer: string;

  @ApiPropertyOptional({ description: 'FAQ grouping category', example: 'Selling' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Display ordering', default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Publish status', default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateFaqDto {
  @ApiPropertyOptional({ description: 'FAQ Question' })
  @IsOptional()
  @IsString()
  question?: string;

  @ApiPropertyOptional({ description: 'Detailed Answer' })
  @IsOptional()
  @IsString()
  answer?: string;

  @ApiPropertyOptional({ description: 'FAQ category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Display ordering' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Publish status' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class ListFaqsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by FAQ category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by publication status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;
}

// ─── BlogPost DTOs ────────────────────────────────────────────────────────────
export class CreateBlogPostDto {
  @ApiProperty({ description: 'Article title', example: 'Top 5 Tips for Buying a Used Car in Singapore' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'URL slug (must be unique)', example: 'top-5-tips-buying-used-car' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ description: 'Full article body content in markdown or HTML' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Short summary / snippet' })
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiPropertyOptional({ description: 'Cover image Cloudinary public ID' })
  @IsOptional()
  @IsString()
  coverPublicId?: string;

  @ApiPropertyOptional({ description: 'Cover image URL' })
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiPropertyOptional({ description: 'Category name', example: 'Guides' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Array of tags', type: [String], example: ['coe', 'used-cars'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Publication status', enum: BlogStatus, default: BlogStatus.DRAFT })
  @IsOptional()
  @IsEnum(BlogStatus)
  status?: BlogStatus;

  @ApiPropertyOptional({ description: 'Meta SEO title' })
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional({ description: 'Meta SEO description' })
  @IsOptional()
  @IsString()
  seoDescription?: string;
}

export class UpdateBlogPostDto {
  @ApiPropertyOptional({ description: 'Article title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'URL slug' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ description: 'Full article body content' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Short summary' })
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiPropertyOptional({ description: 'Cover image Cloudinary public ID' })
  @IsOptional()
  @IsString()
  coverPublicId?: string;

  @ApiPropertyOptional({ description: 'Cover image URL' })
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiPropertyOptional({ description: 'Category name' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Array of tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Publication status', enum: BlogStatus })
  @IsOptional()
  @IsEnum(BlogStatus)
  status?: BlogStatus;

  @ApiPropertyOptional({ description: 'Meta SEO title' })
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional({ description: 'Meta SEO description' })
  @IsOptional()
  @IsString()
  seoDescription?: string;
}

export class ListBlogPostsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by publication status', enum: BlogStatus })
  @IsOptional()
  @IsEnum(BlogStatus)
  status?: BlogStatus;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Search term for title or content' })
  @IsOptional()
  @IsString()
  search?: string;
}
