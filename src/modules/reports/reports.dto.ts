import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional } from 'class-validator';
import { ReportType } from './report-job.entity';

export class CreateReportDto {
  @ApiProperty({
    description: 'Type of report to export',
    enum: ReportType,
    example: ReportType.INVENTORY,
  })
  @IsEnum(ReportType)
  type: ReportType;

  @ApiPropertyOptional({
    description: 'Optional filter criteria used when generating the report',
    example: { from: '2026-01-01', to: '2026-09-17', status: 'AVAILABLE' },
  })
  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}
