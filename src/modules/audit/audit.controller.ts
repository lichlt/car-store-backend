import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuditService } from './audit.service';
import { ListAuditLogsDto } from './audit.dto';
import { ActivityLog } from './entities/activity-log.entity';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { RequirePermissions } from '../../common/decorators';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit.view')
  @ApiOperation({ summary: 'List system audit activity logs with pagination and filters' })
  findAll(@Query() dto: ListAuditLogsDto): Promise<PaginatedResult<ActivityLog>> {
    return this.auditService.findAll(dto);
  }
}
