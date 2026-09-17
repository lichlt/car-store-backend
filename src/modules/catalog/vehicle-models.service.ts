import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { PaginatedResult, PaginationDto, paginate } from '../../common/dto/pagination.dto';
import {
  CreateVehicleModelDto,
  ListModelsDto,
  UpdateVehicleModelDto,
} from './catalog.dto';
import { Brand } from './entities/brand.entity';
import { VehicleModel } from './entities/vehicle-model.entity';

@Injectable()
export class VehicleModelsService {
  constructor(
    @InjectRepository(VehicleModel)
    private readonly modelRepo: Repository<VehicleModel>,

    @InjectRepository(Brand)
    private readonly brandRepo: Repository<Brand>,
  ) {}

  async findAll(dto: ListModelsDto): Promise<PaginatedResult<VehicleModel>> {
    const where: FindOptionsWhere<VehicleModel> = {};

    if (dto.brandId) {
      where.brandId = dto.brandId;
    }

    if (dto.isActive !== undefined) {
      where.isActive = dto.isActive;
    }

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const [items, total] = await this.modelRepo.findAndCount({
      where,
      relations: ['brand'],
      order: { name: 'ASC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(items, total, dto);
  }

  async findById(id: string): Promise<VehicleModel> {
    const model = await this.modelRepo.findOne({
      where: { id },
      relations: ['brand'],
    });

    if (!model) {
      throw new NotFoundException(`Vehicle model with ID "${id}" not found`);
    }

    return model;
  }

  async findByBrand(
    brandId: string,
    dto: PaginationDto,
  ): Promise<PaginatedResult<VehicleModel>> {
    const brand = await this.brandRepo.findOne({
      where: { id: brandId },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID "${brandId}" not found`);
    }

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const [items, total] = await this.modelRepo.findAndCount({
      where: { brandId },
      relations: ['brand'],
      order: { name: 'ASC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(items, total, dto);
  }

  async create(dto: CreateVehicleModelDto): Promise<VehicleModel> {
    const brand = await this.brandRepo.findOne({
      where: { id: dto.brandId },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID "${dto.brandId}" not found`);
    }

    const slug = dto.slug.toLowerCase().trim();
    const existing = await this.modelRepo.findOne({
      where: { brandId: dto.brandId, slug },
    });

    if (existing) {
      throw new ConflictException(
        `Model slug "${dto.slug}" already exists for brand "${brand.name}"`,
      );
    }

    const model = this.modelRepo.create({
      ...dto,
      slug,
      brand,
    });

    return this.modelRepo.save(model);
  }

  async update(id: string, dto: UpdateVehicleModelDto): Promise<VehicleModel> {
    const model = await this.findById(id);

    const targetBrandId = dto.brandId ?? model.brandId;

    if (dto.brandId && dto.brandId !== model.brandId) {
      const brand = await this.brandRepo.findOne({
        where: { id: dto.brandId },
      });

      if (!brand) {
        throw new NotFoundException(`Brand with ID "${dto.brandId}" not found`);
      }
      model.brand = brand;
    }

    const targetSlug = dto.slug ? dto.slug.toLowerCase().trim() : model.slug;

    if (
      (dto.slug && targetSlug !== model.slug) ||
      (dto.brandId && dto.brandId !== model.brandId)
    ) {
      const existing = await this.modelRepo.findOne({
        where: { brandId: targetBrandId, slug: targetSlug },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Model slug "${targetSlug}" already exists for this brand`,
        );
      }
    }

    if (dto.slug) {
      dto.slug = targetSlug;
    }

    const merged = this.modelRepo.merge(model, dto);
    return this.modelRepo.save(merged);
  }

  async remove(id: string): Promise<void> {
    const model = await this.findById(id);
    model.deletedAt = new Date();
    await this.modelRepo.save(model);
  }
}
