import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { DashboardService } from './dashboard.service';
import {
  DashboardQueryDto,
  DashboardStats,
  InventoryStatusBreakdown,
  LeadChartPoint,
  RecentActivitiesQueryDto,
} from './dashboard.dto';
import { ActivityLog } from '../audit/entities/activity-log.entity';
import { RequirePermissions } from '../../common/decorators';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Get overview KPI counters across cars, leads, and inquiries' })
  getStats(): Promise<DashboardStats> {
    return this.dashboardService.getStats();
  }

  @Get('inventory')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Get inventory breakdown by car status' })
  getInventoryStats(): Promise<InventoryStatusBreakdown[]> {
    return this.dashboardService.getInventoryStats();
  }

  @Get('charts')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Get time-series chart data for lead acquisitions' })
  getLeadsChart(@Query() dto: DashboardQueryDto): Promise<LeadChartPoint[]> {
    return this.dashboardService.getLeadsChart(dto);
  }

  @Get('activities')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Get recent admin activity logs' })
  getRecentActivities(
    @Query() query: RecentActivitiesQueryDto,
  ): Promise<ActivityLog[]> {
    return this.dashboardService.getRecentActivities(query.limit);
  }
}
