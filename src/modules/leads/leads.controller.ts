import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { LeadsService } from './leads.service';
import {
  AddCommunicationDto,
  AddNoteDto,
  AssignLeadDto,
  ListLeadsDto,
  SubmitLeadDto,
  UpdateLeadDto,
  UpdateLeadStatusDto,
} from './leads.dto';
import { Lead } from './entities/lead.entity';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { CurrentUser, Public, RequirePermissions } from '../../common/decorators';
import { RequestUser } from '../../common/types/jwt-payload.interface';

// ──────────────────────────────────────────────────────────────────────────────
// PublicLeadsController (Public endpoints)
// ──────────────────────────────────────────────────────────────────────────────
@ApiTags('Public - Leads')
@Controller('public/leads')
export class PublicLeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a new trade-in or sell lead (Public)' })
  submitLead(@Body() dto: SubmitLeadDto): Promise<Lead> {
    return this.leadsService.submitLead(dto);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// LeadsController (Admin staff endpoints)
// ──────────────────────────────────────────────────────────────────────────────
@ApiTags('Leads')
@ApiBearerAuth()
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @RequirePermissions('leads.view')
  @ApiOperation({ summary: 'List leads with filtering, search, and pagination' })
  findAll(@Query() dto: ListLeadsDto): Promise<PaginatedResult<Lead>> {
    return this.leadsService.findAll(dto);
  }

  @Get(':id')
  @RequirePermissions('leads.view')
  @ApiOperation({ summary: 'Get a single lead by UUID' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Lead> {
    return this.leadsService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('leads.update')
  @ApiOperation({ summary: 'Update general lead details' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
  ): Promise<Lead> {
    return this.leadsService.update(id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('leads.update')
  @ApiOperation({ summary: 'Update workflow status of a lead' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadStatusDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Lead> {
    return this.leadsService.updateStatus(id, dto, actor);
  }

  @Patch(':id/assignee')
  @RequirePermissions('leads.assign')
  @ApiOperation({ summary: 'Assign a lead to a staff member' })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignLeadDto,
  ): Promise<Lead> {
    return this.leadsService.assign(id, dto);
  }

  @Post(':id/notes')
  @RequirePermissions('leads.update')
  @ApiOperation({ summary: 'Add an internal note to a lead' })
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddNoteDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Lead> {
    return this.leadsService.addNote(id, dto, actor);
  }

  @Post(':id/communications')
  @RequirePermissions('leads.update')
  @ApiOperation({ summary: 'Record a communication entry for a lead' })
  addCommunication(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCommunicationDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Lead> {
    return this.leadsService.addCommunication(id, dto, actor);
  }
}
