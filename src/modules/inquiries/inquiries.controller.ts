import {
  Body,
  Controller,
  Delete,
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

import { InquiriesService } from './inquiries.service';
import {
  AddInquiryNoteDto,
  AssignInquiryDto,
  ListInquiriesDto,
  SubmitInquiryDto,
  UpdateInquiryStatusDto,
} from './inquiries.dto';
import { Inquiry } from './entities/inquiry.entity';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { CurrentUser, Public, RequirePermissions } from '../../common/decorators';
import { RequestUser } from '../../common/types/jwt-payload.interface';

// ──────────────────────────────────────────────────────────────────────────────
// PublicInquiriesController
// ──────────────────────────────────────────────────────────────────────────────
@ApiTags('Public - Inquiries')
@Controller('public/inquiries')
export class PublicInquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a new customer inquiry (Public)' })
  submitInquiry(@Body() dto: SubmitInquiryDto): Promise<Inquiry> {
    return this.inquiriesService.submitInquiry(dto);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// InquiriesController (Admin staff)
// ──────────────────────────────────────────────────────────────────────────────
@ApiTags('Inquiries')
@ApiBearerAuth()
@Controller('inquiries')
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Get()
  @RequirePermissions('inquiries.view')
  @ApiOperation({ summary: 'List customer inquiries with filters and pagination' })
  findAll(@Query() dto: ListInquiriesDto): Promise<PaginatedResult<Inquiry>> {
    return this.inquiriesService.findAll(dto);
  }

  @Get(':id')
  @RequirePermissions('inquiries.view')
  @ApiOperation({ summary: 'Get a single customer inquiry by UUID' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Inquiry> {
    return this.inquiriesService.findById(id);
  }

  @Patch(':id/status')
  @RequirePermissions('inquiries.update')
  @ApiOperation({ summary: 'Update status of an inquiry' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInquiryStatusDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Inquiry> {
    return this.inquiriesService.updateStatus(id, dto, actor);
  }

  @Patch(':id/assignee')
  @RequirePermissions('inquiries.assign')
  @ApiOperation({ summary: 'Assign an inquiry to a staff member' })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignInquiryDto,
  ): Promise<Inquiry> {
    return this.inquiriesService.assign(id, dto);
  }

  @Post(':id/notes')
  @RequirePermissions('inquiries.update')
  @ApiOperation({ summary: 'Add an internal staff note to an inquiry' })
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddInquiryNoteDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Inquiry> {
    return this.inquiriesService.addNote(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('inquiries.update')
  @ApiOperation({ summary: 'Soft delete an inquiry' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.inquiriesService.remove(id);
  }
}
