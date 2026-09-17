import 'multer';
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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { RequestUser } from '../../common/types/jwt-payload.interface';
import { CarImagesService } from './car-images.service';
import {
  CreateCarDto,
  ListCarsDto,
  UpdateCarDto,
  UpdateCarFeaturedDto,
  UpdateCarStatusDto,
  UpdateCoverImageDto,
  UpdateImageOrderDto,
} from './cars.dto';
import { CarsService } from './cars.service';
import { CarImage } from './entities/car-image.entity';
import { Car } from './entities/car.entity';

// ──────────────────────────────────────────────────────────────────────────────
// CarsController (Admin & Management)
// ──────────────────────────────────────────────────────────────────────────────

@ApiTags('Cars')
@ApiBearerAuth()
@Controller('cars')
export class CarsController {
  constructor(
    private readonly carsService: CarsService,
    private readonly carImagesService: CarImagesService,
  ) {}

  // ─── Filters & Metadata ───────────────────────────────────────────────────

  @Get('filters')
  @RequirePermissions('cars.view')
  @ApiOperation({ summary: 'Get distinct filter values (brands, fuel types, transmissions, years)' })
  getFilters(): Promise<{
    brands: string[];
    fuelTypes: string[];
    transmissions: string[];
    years: number[];
  }> {
    return this.carsService.getFilters();
  }

  // ─── Cars List & Create ───────────────────────────────────────────────────

  @Get()
  @RequirePermissions('cars.view')
  @ApiOperation({ summary: 'List cars with pagination, search, and filters' })
  findAll(@Query() dto: ListCarsDto): Promise<PaginatedResult<Car>> {
    return this.carsService.findAll(dto);
  }

  @Post()
  @RequirePermissions('cars.create')
  @ApiOperation({ summary: 'Create a new car listing (defaults to DRAFT)' })
  create(
    @Body() dto: CreateCarDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Car> {
    return this.carsService.create(dto, actor.sub);
  }

  // ─── Car Detail, Update & Delete ──────────────────────────────────────────

  @Get(':id')
  @RequirePermissions('cars.view')
  @ApiOperation({ summary: 'Get car by ID with images' })
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<Car> {
    return this.carsService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('cars.update')
  @ApiOperation({ summary: 'Update car details' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCarDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Car> {
    return this.carsService.update(id, dto, actor.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('cars.delete')
  @ApiOperation({ summary: 'Soft delete car (cannot delete RESERVED or SOLD)' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.carsService.remove(id);
  }

  // ─── Status & Featured ────────────────────────────────────────────────────

  @Patch(':id/status')
  @RequirePermissions('cars.status.update')
  @ApiOperation({ summary: 'Change car status according to state transition rules' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCarStatusDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Car> {
    return this.carsService.updateStatus(id, dto, actor);
  }

  @Patch(':id/featured')
  @RequirePermissions('cars.update')
  @ApiOperation({ summary: 'Toggle or set car featured flag' })
  updateFeatured(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCarFeaturedDto,
  ): Promise<Car> {
    return this.carsService.updateFeatured(id, dto);
  }

  // ─── Car Images Management ────────────────────────────────────────────────

  @Post(':id/images')
  @RequirePermissions('cars.update')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload up to 10 images for a car to Cloudinary' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  uploadImages(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<CarImage[]> {
    return this.carImagesService.uploadImages(id, files);
  }

  @Patch(':id/images/order')
  @RequirePermissions('cars.update')
  @ApiOperation({ summary: 'Reorder car images by image UUID list' })
  updateImageOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateImageOrderDto,
  ): Promise<void> {
    return this.carImagesService.updateOrder(id, dto.imageIds);
  }

  @Patch(':id/images/cover')
  @RequirePermissions('cars.update')
  @ApiOperation({ summary: 'Set the primary cover image for a car' })
  setCoverImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCoverImageDto,
  ): Promise<void> {
    return this.carImagesService.setCover(id, dto.imageId);
  }

  @Delete(':id/images/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('cars.update')
  @ApiOperation({ summary: 'Delete a car image from database and Cloudinary' })
  removeImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ): Promise<void> {
    return this.carImagesService.removeImage(id, imageId);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// PublicCarsController (Public Website API)
// ──────────────────────────────────────────────────────────────────────────────

@ApiTags('Public Cars')
@Controller('public/cars')
export class PublicCarsController {
  constructor(private readonly carsService: CarsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Public listing of available cars' })
  findPublic(@Query() dto: ListCarsDto): Promise<PaginatedResult<Car>> {
    return this.carsService.findPublic(dto);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Public details of an available car by slug' })
  findBySlug(@Param('slug') slug: string): Promise<Car> {
    return this.carsService.findBySlug(slug);
  }
}
