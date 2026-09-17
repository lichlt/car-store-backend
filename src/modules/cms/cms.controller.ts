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

import { CmsService } from './cms.service';
import {
  CreateBlogPostDto,
  CreateContentPageDto,
  CreateFaqDto,
  CreateShowroomDto,
  CreateTeamMemberDto,
  ListBlogPostsDto,
  ListContentPagesDto,
  ListFaqsDto,
  ListShowroomsDto,
  ListTeamMembersDto,
  UpdateBlogPostDto,
  UpdateContentPageDto,
  UpdateFaqDto,
  UpdateShowroomDto,
  UpdateTeamMemberDto,
} from './cms.dto';
import { ContentPage } from './entities/content-page.entity';
import { Showroom } from './entities/showroom.entity';
import { TeamMember } from './entities/team-member.entity';
import { Faq } from './entities/faq.entity';
import { BlogPost } from './entities/blog-post.entity';
import { CurrentUser, Public, RequirePermissions } from '../../common/decorators';
import { RequestUser } from '../../common/types/jwt-payload.interface';
import { PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';

// ──────────────────────────────────────────────────────────────────────────────
// PublicContentController (Public Read Routes)
// ──────────────────────────────────────────────────────────────────────────────
@ApiTags('Public - CMS')
@Controller('public/content')
export class PublicContentController {
  constructor(private readonly cmsService: CmsService) {}

  @Public()
  @Get('showrooms')
  @ApiOperation({ summary: 'List all active showrooms (Public)' })
  getShowrooms(): Promise<Showroom[]> {
    return this.cmsService.findActiveShowrooms();
  }

  @Public()
  @Get('team')
  @ApiOperation({ summary: 'List all active team members (Public)' })
  getTeam(): Promise<TeamMember[]> {
    return this.cmsService.findActiveTeamMembers();
  }

  @Public()
  @Get('faqs')
  @ApiOperation({ summary: 'List all published FAQs (Public)' })
  getFaqs(): Promise<Faq[]> {
    return this.cmsService.findPublishedFaqs();
  }

  @Public()
  @Get('blog')
  @ApiOperation({ summary: 'List published blog articles with pagination (Public)' })
  getBlogPosts(@Query() dto: PaginationDto): Promise<PaginatedResult<BlogPost>> {
    return this.cmsService.findPublishedBlogPosts(dto);
  }

  @Public()
  @Get('blog/:slug')
  @ApiOperation({ summary: 'Get a published blog article by slug (Public)' })
  getBlogPostBySlug(@Param('slug') slug: string): Promise<BlogPost> {
    return this.cmsService.findPublishedBlogPostBySlug(slug);
  }

  @Public()
  @Get('pages/:key')
  @ApiOperation({ summary: 'Get a published content page by unique key (Public)' })
  getPageByKey(@Param('key') key: string): Promise<ContentPage> {
    return this.cmsService.findPageByKey(key);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// ContentController (Admin CMS Routes)
// ──────────────────────────────────────────────────────────────────────────────
@ApiTags('CMS Content Management')
@ApiBearerAuth()
@Controller('content')
export class ContentController {
  constructor(private readonly cmsService: CmsService) {}

  // ── Pages ──────────────────────────────────────────────────────────────────
  @Get('pages')
  @RequirePermissions('cms.view')
  @ApiOperation({ summary: 'List all content pages' })
  listPages(@Query() dto: ListContentPagesDto): Promise<PaginatedResult<ContentPage>> {
    return this.cmsService.findAllPages(dto);
  }

  @Get('pages/:id')
  @RequirePermissions('cms.view')
  @ApiOperation({ summary: 'Get a content page by UUID' })
  getPage(@Param('id', ParseUUIDPipe) id: string): Promise<ContentPage> {
    return this.cmsService.findPageById(id);
  }

  @Post('pages')
  @RequirePermissions('cms.create')
  @ApiOperation({ summary: 'Create a new content page' })
  createPage(@Body() dto: CreateContentPageDto): Promise<ContentPage> {
    return this.cmsService.createPage(dto);
  }

  @Patch('pages/:id')
  @RequirePermissions('cms.update')
  @ApiOperation({ summary: 'Update an existing content page' })
  updatePage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContentPageDto,
  ): Promise<ContentPage> {
    return this.cmsService.updatePage(id, dto);
  }

  @Delete('pages/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('cms.delete')
  @ApiOperation({ summary: 'Delete a content page' })
  async deletePage(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.cmsService.deletePage(id);
  }

  // ── Showrooms ───────────────────────────────────────────────────────────────
  @Get('showrooms')
  @RequirePermissions('cms.view')
  @ApiOperation({ summary: 'List all showrooms (admin)' })
  listShowrooms(@Query() dto: ListShowroomsDto): Promise<PaginatedResult<Showroom>> {
    return this.cmsService.findAllShowrooms(dto);
  }

  @Get('showrooms/:id')
  @RequirePermissions('cms.view')
  @ApiOperation({ summary: 'Get showroom by UUID' })
  getShowroom(@Param('id', ParseUUIDPipe) id: string): Promise<Showroom> {
    return this.cmsService.findShowroomById(id);
  }

  @Post('showrooms')
  @RequirePermissions('cms.create')
  @ApiOperation({ summary: 'Create a new showroom' })
  createShowroom(@Body() dto: CreateShowroomDto): Promise<Showroom> {
    return this.cmsService.createShowroom(dto);
  }

  @Patch('showrooms/:id')
  @RequirePermissions('cms.update')
  @ApiOperation({ summary: 'Update a showroom' })
  updateShowroom(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShowroomDto,
  ): Promise<Showroom> {
    return this.cmsService.updateShowroom(id, dto);
  }

  @Delete('showrooms/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('cms.delete')
  @ApiOperation({ summary: 'Soft delete a showroom' })
  async deleteShowroom(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.cmsService.deleteShowroom(id);
  }

  // ── Team Members ────────────────────────────────────────────────────────────
  @Get('team')
  @RequirePermissions('cms.view')
  @ApiOperation({ summary: 'List all team members (admin)' })
  listTeam(@Query() dto: ListTeamMembersDto): Promise<PaginatedResult<TeamMember>> {
    return this.cmsService.findAllTeamMembers(dto);
  }

  @Get('team/:id')
  @RequirePermissions('cms.view')
  @ApiOperation({ summary: 'Get team member by UUID' })
  getTeamMember(@Param('id', ParseUUIDPipe) id: string): Promise<TeamMember> {
    return this.cmsService.findTeamMemberById(id);
  }

  @Post('team')
  @RequirePermissions('cms.create')
  @ApiOperation({ summary: 'Create a team member' })
  createTeamMember(@Body() dto: CreateTeamMemberDto): Promise<TeamMember> {
    return this.cmsService.createTeamMember(dto);
  }

  @Patch('team/:id')
  @RequirePermissions('cms.update')
  @ApiOperation({ summary: 'Update a team member' })
  updateTeamMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamMemberDto,
  ): Promise<TeamMember> {
    return this.cmsService.updateTeamMember(id, dto);
  }

  @Delete('team/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('cms.delete')
  @ApiOperation({ summary: 'Soft delete a team member' })
  async deleteTeamMember(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.cmsService.deleteTeamMember(id);
  }

  // ── FAQs ────────────────────────────────────────────────────────────────────
  @Get('faqs')
  @RequirePermissions('cms.view')
  @ApiOperation({ summary: 'List all FAQs (admin)' })
  listFaqs(@Query() dto: ListFaqsDto): Promise<PaginatedResult<Faq>> {
    return this.cmsService.findAllFaqs(dto);
  }

  @Get('faqs/:id')
  @RequirePermissions('cms.view')
  @ApiOperation({ summary: 'Get FAQ by UUID' })
  getFaq(@Param('id', ParseUUIDPipe) id: string): Promise<Faq> {
    return this.cmsService.findFaqById(id);
  }

  @Post('faqs')
  @RequirePermissions('cms.create')
  @ApiOperation({ summary: 'Create a new FAQ' })
  createFaq(@Body() dto: CreateFaqDto): Promise<Faq> {
    return this.cmsService.createFaq(dto);
  }

  @Patch('faqs/:id')
  @RequirePermissions('cms.update')
  @ApiOperation({ summary: 'Update a FAQ' })
  updateFaq(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFaqDto,
  ): Promise<Faq> {
    return this.cmsService.updateFaq(id, dto);
  }

  @Delete('faqs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('cms.delete')
  @ApiOperation({ summary: 'Delete a FAQ' })
  async deleteFaq(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.cmsService.deleteFaq(id);
  }

  // ── Blog Posts ──────────────────────────────────────────────────────────────
  @Get('blog')
  @RequirePermissions('cms.view')
  @ApiOperation({ summary: 'List all blog posts (admin)' })
  listBlogPosts(@Query() dto: ListBlogPostsDto): Promise<PaginatedResult<BlogPost>> {
    return this.cmsService.findAllBlogPosts(dto);
  }

  @Get('blog/:id')
  @RequirePermissions('cms.view')
  @ApiOperation({ summary: 'Get blog post by UUID' })
  getBlogPost(@Param('id', ParseUUIDPipe) id: string): Promise<BlogPost> {
    return this.cmsService.findBlogPostById(id);
  }

  @Post('blog')
  @RequirePermissions('cms.create')
  @ApiOperation({ summary: 'Create a new blog post' })
  createBlogPost(
    @Body() dto: CreateBlogPostDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<BlogPost> {
    return this.cmsService.createBlogPost(dto, actor.sub);
  }

  @Patch('blog/:id')
  @RequirePermissions('cms.update')
  @ApiOperation({ summary: 'Update an existing blog post' })
  updateBlogPost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBlogPostDto,
  ): Promise<BlogPost> {
    return this.cmsService.updateBlogPost(id, dto);
  }

  @Delete('blog/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('cms.delete')
  @ApiOperation({ summary: 'Soft delete a blog post' })
  async deleteBlogPost(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.cmsService.deleteBlogPost(id);
  }
}
