import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PaginatedResult, paginate } from '../../common/dto/pagination.dto';
import { RequestUser } from '../../common/types/jwt-payload.interface';
import { User } from '../users/entities/user.entity';
import {
  CarSortField,
  CreateCarDto,
  ListCarsDto,
  SortDirection,
  UpdateCarDto,
  UpdateCarFeaturedDto,
  UpdateCarStatusDto,
} from './cars.dto';
import { CarImage } from './entities/car-image.entity';
import { Car, CarStatus } from './entities/car.entity';

const VALID_STATUS_TRANSITIONS: Record<CarStatus, CarStatus[]> = {
  [CarStatus.DRAFT]: [CarStatus.AVAILABLE],
  [CarStatus.AVAILABLE]: [CarStatus.RESERVED, CarStatus.SOLD, CarStatus.DRAFT],
  [CarStatus.RESERVED]: [CarStatus.AVAILABLE, CarStatus.SOLD],
  [CarStatus.SOLD]: [CarStatus.RESERVED],
};

@Injectable()
export class CarsService {
  constructor(
    @InjectRepository(Car)
    private readonly carRepo: Repository<Car>,

    @InjectRepository(CarImage)
    private readonly carImageRepo: Repository<CarImage>,
  ) {}

  // ─── Query List (Admin) ───────────────────────────────────────────────────

  async findAll(dto: ListCarsDto): Promise<PaginatedResult<Car>> {
    const qb = this.buildCarsQuery(dto);
    return this.executePaginatedQuery(qb, dto);
  }

  // ─── Query List (Public) ──────────────────────────────────────────────────

  async findPublic(dto: ListCarsDto): Promise<PaginatedResult<Car>> {
    const publicDto: ListCarsDto = {
      ...dto,
      status: CarStatus.AVAILABLE,
      isHidden: false,
    };
    const qb = this.buildCarsQuery(publicDto);
    return this.executePaginatedQuery(qb, publicDto);
  }

  // ─── Find By ID ───────────────────────────────────────────────────────────

  async findById(id: string): Promise<Car> {
    const car = await this.carRepo.findOne({
      where: { id },
      relations: ['images'],
      order: { images: { position: 'ASC' } },
    });

    if (!car) {
      throw new NotFoundException(`Car with ID "${id}" not found`);
    }

    return car;
  }

  // ─── Find By Slug (Public) ────────────────────────────────────────────────

  async findBySlug(slug: string): Promise<Car> {
    const car = await this.carRepo.findOne({
      where: {
        slug,
        status: CarStatus.AVAILABLE,
        isHidden: false,
      },
      relations: ['images'],
      order: { images: { position: 'ASC' } },
    });

    if (!car) {
      throw new NotFoundException(`Car with slug "${slug}" not found`);
    }

    return car;
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(dto: CreateCarDto, actorId?: string): Promise<Car> {
    let stockNo = this.generateStockNo(dto.year);
    let attempts = 0;
    while (await this.carRepo.findOne({ where: { stockNo } })) {
      stockNo = this.generateStockNo(dto.year);
      attempts++;
      if (attempts > 10) {
        throw new ConflictException('Failed to generate unique stock number');
      }
    }

    const sanitizedVariant = dto.variant
      ? dto.variant.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      : 'car';
    const slug = `${dto.year}-${sanitizedVariant}-${stockNo.toLowerCase()}`;

    const car = this.carRepo.create({
      ...dto,
      stockNo,
      slug,
      status: CarStatus.DRAFT,
      isHidden: false,
      isFeatured: false,
      createdBy: actorId ? ({ id: actorId } as User) : null,
      updatedBy: actorId ? ({ id: actorId } as User) : null,
    });

    return this.carRepo.save(car);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateCarDto, actorId?: string): Promise<Car> {
    const car = await this.findById(id);

    if (dto.stockNo && dto.stockNo !== car.stockNo) {
      const existing = await this.carRepo.findOne({
        where: { stockNo: dto.stockNo },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Stock number "${dto.stockNo}" already exists`);
      }
    }

    if (dto.slug && dto.slug !== car.slug) {
      const existing = await this.carRepo.findOne({
        where: { slug: dto.slug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Slug "${dto.slug}" already exists`);
      }
    }

    const merged = this.carRepo.merge(car, dto);
    if (actorId) {
      merged.updatedBy = { id: actorId } as User;
    }

    return this.carRepo.save(merged);
  }

  // ─── Update Status ────────────────────────────────────────────────────────

  async updateStatus(
    id: string,
    dto: UpdateCarStatusDto,
    actor: RequestUser,
  ): Promise<Car> {
    const car = await this.findById(id);

    if (car.status === dto.status) {
      return car;
    }

    const allowedTransitions = VALID_STATUS_TRANSITIONS[car.status] ?? [];
    if (!allowedTransitions.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status transition from "${car.status}" to "${dto.status}"`,
      );
    }

    if (car.status === CarStatus.SOLD && dto.status === CarStatus.RESERVED) {
      if (actor.role !== 'SUPER_ADMIN') {
        throw new ForbiddenException(
          'Only SUPER_ADMIN can transition car from SOLD to RESERVED',
        );
      }
      if (!dto.reason) {
        throw new BadRequestException(
          'A reason is required when transitioning a car from SOLD to RESERVED',
        );
      }
    }

    if (car.status === CarStatus.DRAFT && dto.status === CarStatus.AVAILABLE) {
      car.publishedAt = car.publishedAt ?? new Date();
    }

    car.status = dto.status;
    car.updatedBy = { id: actor.sub } as User;

    return this.carRepo.save(car);
  }

  // ─── Update Featured ──────────────────────────────────────────────────────

  async updateFeatured(id: string, dto: UpdateCarFeaturedDto): Promise<Car> {
    const car = await this.findById(id);
    car.isFeatured = dto.isFeatured;
    return this.carRepo.save(car);
  }

  // ─── Remove (Soft Delete) ─────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    const car = await this.findById(id);

    if (car.status === CarStatus.RESERVED || car.status === CarStatus.SOLD) {
      throw new BadRequestException(
        `Cannot delete car with status "${car.status}"`,
      );
    }

    car.deletedAt = new Date();
    await this.carRepo.save(car);
  }

  // ─── Get Filters ──────────────────────────────────────────────────────────

  async getFilters(): Promise<{
    brands: string[];
    fuelTypes: string[];
    transmissions: string[];
    years: number[];
  }> {
    const [brandsRaw, fuelTypesRaw, transmissionsRaw, yearsRaw] = await Promise.all([
      this.carRepo
        .createQueryBuilder('car')
        .select('DISTINCT car.brand_id', 'brandId')
        .where('car.deleted_at IS NULL')
        .getRawMany<{ brandId: string }>(),

      this.carRepo
        .createQueryBuilder('car')
        .select('DISTINCT car.fuel_type', 'fuelType')
        .where('car.fuel_type IS NOT NULL AND car.deleted_at IS NULL')
        .getRawMany<{ fuelType: string }>(),

      this.carRepo
        .createQueryBuilder('car')
        .select('DISTINCT car.transmission', 'transmission')
        .where('car.transmission IS NOT NULL AND car.deleted_at IS NULL')
        .getRawMany<{ transmission: string }>(),

      this.carRepo
        .createQueryBuilder('car')
        .select('DISTINCT car.year', 'year')
        .where('car.deleted_at IS NULL')
        .orderBy('car.year', 'DESC')
        .getRawMany<{ year: number }>(),
    ]);

    return {
      brands: brandsRaw.map((b) => b.brandId).filter(Boolean),
      fuelTypes: fuelTypesRaw.map((f) => f.fuelType).filter(Boolean),
      transmissions: transmissionsRaw.map((t) => t.transmission).filter(Boolean),
      years: yearsRaw.map((y) => Number(y.year)).filter((y) => !Number.isNaN(y)),
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private generateStockNo(year: number): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rand = '';
    for (let i = 0; i < 5; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `CS-${year}-${rand}`;
  }

  private buildCarsQuery(dto: ListCarsDto): SelectQueryBuilder<Car> {
    const qb = this.carRepo
      .createQueryBuilder('car')
      .leftJoinAndSelect('car.images', 'images')
      .where('car.deletedAt IS NULL');

    if (dto.status) {
      qb.andWhere('car.status = :status', { status: dto.status });
    }

    if (dto.brandId) {
      qb.andWhere('car.brandId = :brandId', { brandId: dto.brandId });
    }

    if (dto.modelId) {
      qb.andWhere('car.modelId = :modelId', { modelId: dto.modelId });
    }

    if (dto.year) {
      qb.andWhere('car.year = :year', { year: dto.year });
    }

    if (dto.isFeatured !== undefined) {
      qb.andWhere('car.isFeatured = :isFeatured', { isFeatured: dto.isFeatured });
    }

    if (dto.isHidden !== undefined) {
      qb.andWhere('car.isHidden = :isHidden', { isHidden: dto.isHidden });
    }

    if (dto.minPrice !== undefined) {
      qb.andWhere('car.priceCents >= :minPrice', { minPrice: dto.minPrice });
    }

    if (dto.maxPrice !== undefined) {
      qb.andWhere('car.priceCents <= :maxPrice', { maxPrice: dto.maxPrice });
    }

    if (dto.search) {
      const searchValue = `%${dto.search}%`;
      qb.andWhere(
        '(car.variant ILIKE :search OR car.description ILIKE :search OR car.stockNo ILIKE :search)',
        { search: searchValue },
      );
    }

    const sortDirection: 'ASC' | 'DESC' = dto.sortDirection ?? 'DESC';
    if (dto.sort === CarSortField.PRICE_CENTS) {
      qb.orderBy('car.priceCents', sortDirection);
    } else if (dto.sort === CarSortField.YEAR) {
      qb.orderBy('car.year', sortDirection);
    } else {
      qb.orderBy('car.createdAt', sortDirection);
    }

    qb.addOrderBy('images.position', 'ASC');

    return qb;
  }

  private async executePaginatedQuery(
    qb: SelectQueryBuilder<Car>,
    dto: ListCarsDto,
  ): Promise<PaginatedResult<Car>> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return paginate(items, total, dto);
  }
}
