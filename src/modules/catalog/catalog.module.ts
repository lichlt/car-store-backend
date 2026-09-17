import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BrandsService } from './brands.service';
import { CatalogController } from './catalog.controller';
import { Brand } from './entities/brand.entity';
import { VehicleModel } from './entities/vehicle-model.entity';
import { VehicleModelsService } from './vehicle-models.service';

@Module({
  imports: [TypeOrmModule.forFeature([Brand, VehicleModel])],
  controllers: [CatalogController],
  providers: [BrandsService, VehicleModelsService],
  exports: [BrandsService, VehicleModelsService, TypeOrmModule],
})
export class CatalogModule {}
