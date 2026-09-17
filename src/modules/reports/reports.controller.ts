import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ReportsService } from './reports.service';
import { CreateReportDto } from './reports.dto';
import { ReportJob } from './report-job.entity';
import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { RequestUser } from '../../common/types/jwt-payload.interface';

@ApiTags('Reports & Exports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions('reports.export')
  @ApiOperation({ summary: 'Queue an asynchronous report export job (returns 202 Accepted)' })
  @ApiResponse({ status: 202, description: 'Report generation job accepted' })
  createJob(
    @Body() dto: CreateReportDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<ReportJob> {
    return this.reportsService.createJob(dto, actor.sub);
  }

  @Get(':id')
  @RequirePermissions('reports.view')
  @ApiOperation({ summary: 'Check status and retrieve generated file URL of a report job' })
  getJob(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ): Promise<ReportJob> {
    return this.reportsService.getJob(id, actor.sub);
  }
}
