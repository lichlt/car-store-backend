import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ContentPage } from './entities/content-page.entity';
import { Showroom } from './entities/showroom.entity';
import { TeamMember } from './entities/team-member.entity';
import { Faq } from './entities/faq.entity';
import { BlogPost, BlogStatus } from './entities/blog-post.entity';
import { User } from '../users/entities/user.entity';

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
import { PaginatedResult, PaginationDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class CmsService {
  constructor(
    @InjectRepository(ContentPage)
    private readonly contentPageRepo: Repository<ContentPage>,
    @InjectRepository(Showroom)
    private readonly showroomRepo: Repository<Showroom>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepo: Repository<TeamMember>,
    @InjectRepository(Faq)
    private readonly faqRepo: Repository<Faq>,
    @InjectRepository(BlogPost)
    private readonly blogPostRepo: Repository<BlogPost>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ════════════════════════════════════════════════════════════════════════════
  // 1. Content Pages
  // ════════════════════════════════════════════════════════════════════════════

  async createPage(dto: CreateContentPageDto): Promise<ContentPage> {
    const existing = await this.contentPageRepo.findOne({ where: { key: dto.key } });
    if (existing) {
      throw new ConflictException(`Content page with key '${dto.key}' already exists`);
    }

    const page = this.contentPageRepo.create({
      key: dto.key,
      title: dto.title,
      blocks: dto.blocks,
      version: 1,
      isPublished: dto.isPublished ?? false,
      publishedAt: dto.isPublished ? new Date() : null,
    });

    return this.contentPageRepo.save(page);
  }

  async findAllPages(dto: ListContentPagesDto): Promise<PaginatedResult<ContentPage>> {
    const qb = this.contentPageRepo.createQueryBuilder('page').orderBy('page.createdAt', 'DESC');

    if (dto.search && dto.search.trim().length > 0) {
      const term = `%${dto.search.trim()}%`;
      qb.andWhere('(page.title ILIKE :term OR page.key ILIKE :term)', { term });
    }

    const total = await qb.getCount();
    const items = await qb
      .skip((dto.page - 1) * dto.limit)
      .take(dto.limit)
      .getMany();

    return paginate(items, total, dto);
  }

  async findPageById(id: string): Promise<ContentPage> {
    const page = await this.contentPageRepo.findOne({ where: { id } });
    if (!page) {
      throw new NotFoundException(`Content page with ID '${id}' not found`);
    }
    return page;
  }

  async findPageByKey(key: string): Promise<ContentPage> {
    const page = await this.contentPageRepo.findOne({
      where: { key, isPublished: true },
    });
    if (!page) {
      throw new NotFoundException(`Published content page '${key}' not found`);
    }
    return page;
  }

  async updatePage(id: string, dto: UpdateContentPageDto): Promise<ContentPage> {
    const page = await this.findPageById(id);

    if (dto.title !== undefined) {
      page.title = dto.title;
    }

    if (dto.blocks !== undefined) {
      page.blocks = dto.blocks;
      page.version += 1;
    }

    if (dto.isPublished !== undefined) {
      if (dto.isPublished && !page.isPublished) {
        page.publishedAt = new Date();
      }
      page.isPublished = dto.isPublished;
    }

    return this.contentPageRepo.save(page);
  }

  async deletePage(id: string): Promise<void> {
    const page = await this.findPageById(id);
    await this.contentPageRepo.remove(page);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. Showrooms
  // ════════════════════════════════════════════════════════════════════════════

  async createShowroom(dto: CreateShowroomDto): Promise<Showroom> {
    const showroom = this.showroomRepo.create({
      name: dto.name,
      address: dto.address,
      lat: dto.lat ?? null,
      lng: dto.lng ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      openingHours: dto.openingHours ?? null,
      images: dto.images ?? [],
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });

    return this.showroomRepo.save(showroom);
  }

  async findAllShowrooms(dto: ListShowroomsDto): Promise<PaginatedResult<Showroom>> {
    const qb = this.showroomRepo
      .createQueryBuilder('sr')
      .orderBy('sr.sortOrder', 'ASC')
      .addOrderBy('sr.createdAt', 'DESC');

    if (dto.isActive !== undefined) {
      qb.andWhere('sr.isActive = :isActive', { isActive: dto.isActive });
    }

    const total = await qb.getCount();
    const items = await qb
      .skip((dto.page - 1) * dto.limit)
      .take(dto.limit)
      .getMany();

    return paginate(items, total, dto);
  }

  async findActiveShowrooms(): Promise<Showroom[]> {
    return this.showroomRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async findShowroomById(id: string): Promise<Showroom> {
    const showroom = await this.showroomRepo.findOne({ where: { id } });
    if (!showroom) {
      throw new NotFoundException(`Showroom with ID '${id}' not found`);
    }
    return showroom;
  }

  async updateShowroom(id: string, dto: UpdateShowroomDto): Promise<Showroom> {
    const showroom = await this.findShowroomById(id);

    if (dto.name !== undefined) showroom.name = dto.name;
    if (dto.address !== undefined) showroom.address = dto.address;
    if (dto.lat !== undefined) showroom.lat = dto.lat;
    if (dto.lng !== undefined) showroom.lng = dto.lng;
    if (dto.phone !== undefined) showroom.phone = dto.phone;
    if (dto.email !== undefined) showroom.email = dto.email;
    if (dto.openingHours !== undefined) showroom.openingHours = dto.openingHours;
    if (dto.images !== undefined) showroom.images = dto.images;
    if (dto.sortOrder !== undefined) showroom.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) showroom.isActive = dto.isActive;

    return this.showroomRepo.save(showroom);
  }

  async deleteShowroom(id: string): Promise<void> {
    const showroom = await this.findShowroomById(id);
    await this.showroomRepo.softRemove(showroom);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 3. Team Members
  // ════════════════════════════════════════════════════════════════════════════

  async createTeamMember(dto: CreateTeamMemberDto): Promise<TeamMember> {
    const member = this.teamMemberRepo.create({
      name: dto.name,
      jobTitle: dto.jobTitle,
      bio: dto.bio ?? null,
      avatarPublicId: dto.avatarPublicId ?? null,
      avatarUrl: dto.avatarUrl ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });

    return this.teamMemberRepo.save(member);
  }

  async findAllTeamMembers(dto: ListTeamMembersDto): Promise<PaginatedResult<TeamMember>> {
    const qb = this.teamMemberRepo
      .createQueryBuilder('tm')
      .orderBy('tm.sortOrder', 'ASC')
      .addOrderBy('tm.createdAt', 'DESC');

    if (dto.isActive !== undefined) {
      qb.andWhere('tm.isActive = :isActive', { isActive: dto.isActive });
    }

    const total = await qb.getCount();
    const items = await qb
      .skip((dto.page - 1) * dto.limit)
      .take(dto.limit)
      .getMany();

    return paginate(items, total, dto);
  }

  async findActiveTeamMembers(): Promise<TeamMember[]> {
    return this.teamMemberRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async findTeamMemberById(id: string): Promise<TeamMember> {
    const member = await this.teamMemberRepo.findOne({ where: { id } });
    if (!member) {
      throw new NotFoundException(`Team member with ID '${id}' not found`);
    }
    return member;
  }

  async updateTeamMember(id: string, dto: UpdateTeamMemberDto): Promise<TeamMember> {
    const member = await this.findTeamMemberById(id);

    if (dto.name !== undefined) member.name = dto.name;
    if (dto.jobTitle !== undefined) member.jobTitle = dto.jobTitle;
    if (dto.bio !== undefined) member.bio = dto.bio;
    if (dto.avatarPublicId !== undefined) member.avatarPublicId = dto.avatarPublicId;
    if (dto.avatarUrl !== undefined) member.avatarUrl = dto.avatarUrl;
    if (dto.phone !== undefined) member.phone = dto.phone;
    if (dto.email !== undefined) member.email = dto.email;
    if (dto.sortOrder !== undefined) member.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) member.isActive = dto.isActive;

    return this.teamMemberRepo.save(member);
  }

  async deleteTeamMember(id: string): Promise<void> {
    const member = await this.findTeamMemberById(id);
    await this.teamMemberRepo.softRemove(member);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 4. FAQs
  // ════════════════════════════════════════════════════════════════════════════

  async createFaq(dto: CreateFaqDto): Promise<Faq> {
    const faq = this.faqRepo.create({
      question: dto.question,
      answer: dto.answer,
      category: dto.category ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isPublished: dto.isPublished ?? false,
    });

    return this.faqRepo.save(faq);
  }

  async findAllFaqs(dto: ListFaqsDto): Promise<PaginatedResult<Faq>> {
    const qb = this.faqRepo
      .createQueryBuilder('faq')
      .orderBy('faq.sortOrder', 'ASC')
      .addOrderBy('faq.createdAt', 'DESC');

    if (dto.category) {
      qb.andWhere('faq.category = :category', { category: dto.category });
    }

    if (dto.isPublished !== undefined) {
      qb.andWhere('faq.isPublished = :isPublished', { isPublished: dto.isPublished });
    }

    const total = await qb.getCount();
    const items = await qb
      .skip((dto.page - 1) * dto.limit)
      .take(dto.limit)
      .getMany();

    return paginate(items, total, dto);
  }

  async findPublishedFaqs(): Promise<Faq[]> {
    return this.faqRepo.find({
      where: { isPublished: true },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async findFaqById(id: string): Promise<Faq> {
    const faq = await this.faqRepo.findOne({ where: { id } });
    if (!faq) {
      throw new NotFoundException(`FAQ with ID '${id}' not found`);
    }
    return faq;
  }

  async updateFaq(id: string, dto: UpdateFaqDto): Promise<Faq> {
    const faq = await this.findFaqById(id);

    if (dto.question !== undefined) faq.question = dto.question;
    if (dto.answer !== undefined) faq.answer = dto.answer;
    if (dto.category !== undefined) faq.category = dto.category;
    if (dto.sortOrder !== undefined) faq.sortOrder = dto.sortOrder;
    if (dto.isPublished !== undefined) faq.isPublished = dto.isPublished;

    return this.faqRepo.save(faq);
  }

  async deleteFaq(id: string): Promise<void> {
    const faq = await this.findFaqById(id);
    await this.faqRepo.remove(faq);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 5. Blog Posts
  // ════════════════════════════════════════════════════════════════════════════

  async createBlogPost(dto: CreateBlogPostDto, authorId?: string): Promise<BlogPost> {
    const existing = await this.blogPostRepo.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`Blog post with slug '${dto.slug}' already exists`);
    }

    let author: User | null = null;
    if (authorId) {
      author = await this.userRepo.findOne({ where: { id: authorId } });
    }

    const isPublished = dto.status === BlogStatus.PUBLISHED;

    const post = this.blogPostRepo.create({
      title: dto.title,
      slug: dto.slug,
      content: dto.content,
      excerpt: dto.excerpt ?? null,
      coverPublicId: dto.coverPublicId ?? null,
      coverUrl: dto.coverUrl ?? null,
      category: dto.category ?? null,
      tags: dto.tags ?? [],
      author,
      status: dto.status ?? BlogStatus.DRAFT,
      seoTitle: dto.seoTitle ?? null,
      seoDescription: dto.seoDescription ?? null,
      publishedAt: isPublished ? new Date() : null,
    });

    return this.blogPostRepo.save(post);
  }

  async findAllBlogPosts(dto: ListBlogPostsDto): Promise<PaginatedResult<BlogPost>> {
    const qb = this.blogPostRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .orderBy('post.createdAt', 'DESC');

    if (dto.status) {
      qb.andWhere('post.status = :status', { status: dto.status });
    }

    if (dto.category) {
      qb.andWhere('post.category = :category', { category: dto.category });
    }

    if (dto.search && dto.search.trim().length > 0) {
      const term = `%${dto.search.trim()}%`;
      qb.andWhere('(post.title ILIKE :term OR post.slug ILIKE :term)', { term });
    }

    const total = await qb.getCount();
    const items = await qb
      .skip((dto.page - 1) * dto.limit)
      .take(dto.limit)
      .getMany();

    return paginate(items, total, dto);
  }

  async findPublishedBlogPosts(dto: PaginationDto): Promise<PaginatedResult<BlogPost>> {
    const qb = this.blogPostRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.status = :status', { status: BlogStatus.PUBLISHED })
      .orderBy('post.publishedAt', 'DESC');

    const total = await qb.getCount();
    const items = await qb
      .skip((dto.page - 1) * dto.limit)
      .take(dto.limit)
      .getMany();

    return paginate(items, total, dto);
  }

  async findPublishedBlogPostBySlug(slug: string): Promise<BlogPost> {
    const post = await this.blogPostRepo.findOne({
      where: { slug, status: BlogStatus.PUBLISHED },
      relations: ['author'],
    });

    if (!post) {
      throw new NotFoundException(`Published blog post with slug '${slug}' not found`);
    }

    return post;
  }

  async findBlogPostById(id: string): Promise<BlogPost> {
    const post = await this.blogPostRepo.findOne({
      where: { id },
      relations: ['author'],
    });

    if (!post) {
      throw new NotFoundException(`Blog post with ID '${id}' not found`);
    }

    return post;
  }

  async updateBlogPost(id: string, dto: UpdateBlogPostDto): Promise<BlogPost> {
    const post = await this.findBlogPostById(id);

    if (dto.slug && dto.slug !== post.slug) {
      const existing = await this.blogPostRepo.findOne({ where: { slug: dto.slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Blog post with slug '${dto.slug}' already exists`);
      }
      post.slug = dto.slug;
    }

    if (dto.title !== undefined) post.title = dto.title;
    if (dto.content !== undefined) post.content = dto.content;
    if (dto.excerpt !== undefined) post.excerpt = dto.excerpt;
    if (dto.coverPublicId !== undefined) post.coverPublicId = dto.coverPublicId;
    if (dto.coverUrl !== undefined) post.coverUrl = dto.coverUrl;
    if (dto.category !== undefined) post.category = dto.category;
    if (dto.tags !== undefined) post.tags = dto.tags;
    if (dto.seoTitle !== undefined) post.seoTitle = dto.seoTitle;
    if (dto.seoDescription !== undefined) post.seoDescription = dto.seoDescription;

    if (dto.status !== undefined) {
      if (dto.status === BlogStatus.PUBLISHED && post.status !== BlogStatus.PUBLISHED) {
        post.publishedAt = new Date();
      }
      post.status = dto.status;
    }

    return this.blogPostRepo.save(post);
  }

  async deleteBlogPost(id: string): Promise<void> {
    const post = await this.findBlogPostById(id);
    await this.blogPostRepo.softRemove(post);
  }
}
