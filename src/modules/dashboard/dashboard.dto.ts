import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export type Granularity = 'day' | 'week' | 'month';

export class DashboardQueryDto {
  @ApiPropertyOptional({
    description: 'Start date in ISO format',
    example: '2026-08-18T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date in ISO format',
    example: '2026-09-17T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: 'User timezone for aggregation (e.g. Asia/Singapore, UTC)',
    example: 'Asia/Singapore',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Time bucket granularity for chart grouping',
    enum: ['day', 'week', 'month'],
    default: 'day',
  })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  granularity?: Granularity;
}

export class RecentActivitiesQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of recent activities to return',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}

export interface DashboardStats {
  totalCars: number;
  availableCars: number;
  reservedCars: number;
  soldCars: number;
  newLeads: number;
  openInquiries: number;
}

export interface InventoryStatusBreakdown {
  status: string;
  count: number;
}

export interface LeadChartPoint {
  date: string;
  count: number;
}
