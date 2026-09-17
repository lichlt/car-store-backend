import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CarImagesService } from './car-images.service';
import { CarsController, PublicCarsController } from './cars.controller';
import { CarsService } from './cars.service';
import { CarImage } from './entities/car-image.entity';
import { Car } from './entities/car.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Car, CarImage])],
  controllers: [CarsController, PublicCarsController],
  providers: [CarsService, CarImagesService],
  exports: [CarsService, CarImagesService, TypeOrmModule],
})
export class CarsModule {}
