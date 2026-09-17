import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { LeadStatus } from './entities/lead.entity';

export class SubmitLeadDto {
  @ApiProperty({
    description: 'Contact information of the lead submitter',
    example: { name: 'John Doe', phone: '+6591234567', email: 'john@example.com' },
  })
  @IsObject()
  @IsNotEmpty()
  contact: Record<string, unknown>;

  @ApiProperty({
    description: 'Car details for trade-in / selling inquiry',
    example: { brand: 'Toyota', model: 'Corolla', year: 2021, mileage: 35000 },
  })
  @IsObject()
  @IsNotEmpty()
  carInfo: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Source or acquisition channel',
    example: 'website_valuation',
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({
    description: 'Uploaded car photo URLs',
    type: [String],
    example: ['https://res.cloudinary.com/.../car1.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

export class ListLeadsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter leads by workflow status',
    enum: LeadStatus,
  })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({
    description: 'Filter leads assigned to a specific admin user UUID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional({
    description: 'Search string matching reference number, contact, or car details',
    example: 'LEAD-2026',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class UpdateLeadDto {
  @ApiPropertyOptional({
    description: 'Updated contact information',
    example: { name: 'Johnathan Doe', phone: '+6591234567' },
  })
  @IsOptional()
  @IsObject()
  contact?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Updated car details',
    example: { brand: 'Toyota', model: 'Corolla Altis', year: 2021 },
  })
  @IsOptional()
  @IsObject()
  carInfo?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Next follow-up date and time in ISO format',
    example: '2026-09-20T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string;

  @ApiPropertyOptional({
    description: 'Offered valuation or quote in cents',
    example: '4500000',
  })
  @IsOptional()
  @IsString()
  quotedPriceCents?: string;
}

export class UpdateLeadStatusDto {
  @ApiProperty({
    description: 'Target workflow status',
    enum: LeadStatus,
  })
  @IsEnum(LeadStatus)
  status: LeadStatus;

  @ApiPropertyOptional({
    description: 'Reason for status update (required when reopening a rejected lead)',
    example: 'Customer reconsidered trade-in offer',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AssignLeadDto {
  @ApiProperty({
    description: 'Staff / Admin user UUID to assign this lead to',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID()
  assignedTo: string;
}

export class AddNoteDto {
  @ApiProperty({
    description: 'Internal staff note content',
    example: 'Called customer; waiting for vehicle log card copy.',
  })
  @IsString()
  @MinLength(1)
  body: string;
}

export class AddCommunicationDto {
  @ApiProperty({
    description: 'Communication channel, e.g. Phone, WhatsApp, Email, In-Person',
    example: 'WhatsApp',
  })
  @IsString()
  @IsNotEmpty()
  channel: string;

  @ApiProperty({
    description: 'Summary of the conversation or interaction',
    example: 'Sent initial valuation range, customer confirmed viewing next Tuesday.',
  })
  @IsString()
  @IsNotEmpty()
  summary: string;

  @ApiProperty({
    description: 'Timestamp when communication took place in ISO format',
    example: '2026-09-17T14:30:00.000Z',
  })
  @IsDateString()
  occurredAt: string;
}
