import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
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
import { InquiryStatus, InquiryType } from './entities/inquiry.entity';

export class SubmitInquiryDto {
  @ApiProperty({
    description: 'Inquiry type category',
    enum: InquiryType,
    example: InquiryType.TEST_DRIVE,
  })
  @IsEnum(InquiryType)
  type: InquiryType;

  @ApiPropertyOptional({
    description: 'Optional car UUID if inquiring about a specific vehicle listing',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @IsOptional()
  @IsUUID()
  carId?: string;

  @ApiProperty({
    description: 'Contact info of the person making the inquiry',
    example: {
      name: 'Alice Tan',
      phone: '+6598765432',
      email: 'alice@example.com',
      message: 'Would love to schedule a test drive this weekend.',
    },
  })
  @IsObject()
  @IsNotEmpty()
  contact: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Preferred appointment date/time in ISO format (e.g. for test drives)',
    example: '2026-09-20T14:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  preferredDate?: string;
}

export class ListInquiriesDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter inquiries by inquiry type',
    enum: InquiryType,
  })
  @IsOptional()
  @IsEnum(InquiryType)
  type?: InquiryType;

  @ApiPropertyOptional({
    description: 'Filter inquiries by status',
    enum: InquiryStatus,
  })
  @IsOptional()
  @IsEnum(InquiryStatus)
  status?: InquiryStatus;

  @ApiPropertyOptional({
    description: 'Filter inquiries assigned to a specific admin user UUID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;
}

export class UpdateInquiryStatusDto {
  @ApiProperty({
    description: 'New workflow status',
    enum: InquiryStatus,
    example: InquiryStatus.CONTACTED,
  })
  @IsEnum(InquiryStatus)
  status: InquiryStatus;

  @ApiPropertyOptional({
    description: 'Optional reason or comment for the status update',
    example: 'Called customer, appointment confirmed for Saturday.',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AssignInquiryDto {
  @ApiProperty({
    description: 'Staff / Admin user UUID to assign this inquiry to',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID()
  assignedTo: string;
}

export class AddInquiryNoteDto {
  @ApiProperty({
    description: 'Staff note content',
    example: 'Customer wants a weekend morning slot.',
  })
  @IsString()
  @MinLength(1)
  body: string;
}
