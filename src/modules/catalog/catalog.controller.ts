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
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import { BrandsService } from './brands.service';
import {
  CreateBrandDto,
  CreateVehicleModelDto,
  ListBrandsDto,
  ListModelsDto,
  UpdateBrandDto,
  UpdateVehicleModelDto,
} from './catalog.dto';
import { Brand } from './entities/brand.entity';
import { VehicleModel } from './entities/vehicle-model.entity';
import { VehicleModelsService } from './vehicle-models.service';

@ApiTags('Catalog')
@ApiBearerAuth()
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly brandsService: BrandsService,
    private readonly vehicleModelsService: VehicleModelsService,
  ) {}

  // ─── Brands Endpoints ───────────────────────────────────────────────────────

  @Get('brands')
  @RequirePermissions('catalog.view')
  @ApiOperation({ summary: 'List all brands with pagination and filters' })
  findBrands(@Query() dto: ListBrandsDto): Promise<PaginatedResult<Brand>> {
    return this.brandsService.findAll(dto);
  }

  @Post('brands')
  @RequirePermissions('catalog.create')
  @ApiOperation({ summary: 'Create a new brand' })
  createBrand(@Body() dto: CreateBrandDto): Promise<Brand> {
    return this.brandsService.create(dto);
  }

  @Get('brands/:id')
  @RequirePermissions('catalog.view')
  @ApiOperation({ summary: 'Get brand by ID' })
  findBrandById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Brand> {
    return this.brandsService.findById(id);
  }

  @Patch('brands/:id')
  @RequirePermissions('catalog.update')
  @ApiOperation({ summary: 'Update brand by ID' })
  updateBrand(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrandDto,
  ): Promise<Brand> {
    return this.brandsService.update(id, dto);
  }

  @Delete('brands/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('catalog.delete')
  @ApiOperation({ summary: 'Soft delete brand by ID' })
  removeBrand(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.brandsService.remove(id);
  }

  @Get('brands/:id/models')
  @RequirePermissions('catalog.view')
  @ApiOperation({ summary: 'Get vehicle models for a specific brand' })
  findModelsByBrand(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: PaginationDto,
  ): Promise<PaginatedResult<VehicleModel>> {
    return this.vehicleModelsService.findByBrand(id, dto);
  }

  // ─── Models Endpoints ───────────────────────────────────────────────────────

  @Get('models')
  @RequirePermissions('catalog.view')
  @ApiOperation({ summary: 'List all vehicle models with pagination and filters' })
  findModels(@Query() dto: ListModelsDto): Promise<PaginatedResult<VehicleModel>> {
    return this.vehicleModelsService.findAll(dto);
  }

  @Post('models')
  @RequirePermissions('catalog.create')
  @ApiOperation({ summary: 'Create a new vehicle model' })
  createModel(@Body() dto: CreateVehicleModelDto): Promise<VehicleModel> {
    return this.vehicleModelsService.create(dto);
  }

  @Get('models/:id')
  @RequirePermissions('catalog.view')
  @ApiOperation({ summary: 'Get vehicle model by ID' })
  findModelById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VehicleModel> {
    return this.vehicleModelsService.findById(id);
  }

  @Patch('models/:id')
  @RequirePermissions('catalog.update')
  @ApiOperation({ summary: 'Update vehicle model by ID' })
  updateModel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleModelDto,
  ): Promise<VehicleModel> {
    return this.vehicleModelsService.update(id, dto);
  }

  @Delete('models/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('catalog.delete')
  @ApiOperation({ summary: 'Soft delete vehicle model by ID' })
  removeModel(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.vehicleModelsService.remove(id);
  }
}
