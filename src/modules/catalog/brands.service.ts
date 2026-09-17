import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { PaginatedResult, paginate } from '../../common/dto/pagination.dto';
import { CreateBrandDto, ListBrandsDto, UpdateBrandDto } from './catalog.dto';
import { Brand } from './entities/brand.entity';

@Injectable()
export class BrandsService {
  constructor(
    @InjectRepository(Brand)
    private readonly brandRepo: Repository<Brand>,
  ) {}

  async findAll(dto: ListBrandsDto): Promise<PaginatedResult<Brand>> {
    const where: FindOptionsWhere<Brand> = {};

    if (dto.isActive !== undefined) {
      where.isActive = dto.isActive;
    }

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const [items, total] = await this.brandRepo.findAndCount({
      where,
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(items, total, dto);
  }

  async findById(id: string): Promise<Brand> {
    const brand = await this.brandRepo.findOne({
      where: { id },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID "${id}" not found`);
    }

    return brand;
  }

  async create(dto: CreateBrandDto): Promise<Brand> {
    const slug = dto.slug.toLowerCase().trim();
    const existing = await this.brandRepo.findOne({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException(`Brand slug "${dto.slug}" already exists`);
    }

    const brand = this.brandRepo.create({
      ...dto,
      slug,
    });

    return this.brandRepo.save(brand);
  }

  async update(id: string, dto: UpdateBrandDto): Promise<Brand> {
    const brand = await this.findById(id);

    if (dto.slug && dto.slug.toLowerCase().trim() !== brand.slug) {
      const normalizedSlug = dto.slug.toLowerCase().trim();
      const existing = await this.brandRepo.findOne({
        where: { slug: normalizedSlug },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(`Brand slug "${dto.slug}" already exists`);
      }
      dto.slug = normalizedSlug;
    }

    const merged = this.brandRepo.merge(brand, dto);
    return this.brandRepo.save(merged);
  }

  async remove(id: string): Promise<void> {
    const brand = await this.findById(id);
    brand.deletedAt = new Date();
    await this.brandRepo.save(brand);
  }
}
