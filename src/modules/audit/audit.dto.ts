import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ActorSnapshot } from './entities/activity-log.entity';

export class LogActivityDto {
  @ApiProperty({
    description: 'Snapshot of the user who performed the action',
    example: {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'admin@carstore.com',
      fullName: 'Super Admin',
      role: 'super_admin',
    },
  })
  @IsObject()
  @IsNotEmpty()
  actor: ActorSnapshot;

  @ApiProperty({ description: 'Action name (e.g. CREATE, UPDATE, DELETE, LOGIN)', example: 'UPDATE' })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiProperty({ description: 'Target domain module (e.g. cars, leads, users)', example: 'leads' })
  @IsString()
  @IsNotEmpty()
  module: string;

  @ApiPropertyOptional({ description: 'Entity UUID or identifier', example: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33' })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Field-level difference / changed attributes',
    example: { status: { from: 'NEW', to: 'CONTACTED' } },
  })
  @IsOptional()
  @IsObject()
  diff?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Correlation request ID', example: 'req-12345' })
  @IsOptional()
  @IsString()
  requestId?: string;
}

export class ListAuditLogsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by module', example: 'leads' })
  @IsOptional()
  @IsString()
  module?: string;

  @ApiPropertyOptional({ description: 'Filter by action', example: 'UPDATE' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by entity UUID' })
  @IsOptional()
  @IsString()
  entityId?: string;
}
