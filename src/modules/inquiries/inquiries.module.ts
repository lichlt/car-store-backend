import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Inquiry } from './entities/inquiry.entity';
import { Car } from '../cars/entities/car.entity';
import { User } from '../users/entities/user.entity';
import { InquiriesService } from './inquiries.service';
import {
  InquiriesController,
  PublicInquiriesController,
} from './inquiries.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Inquiry, Car, User])],
  controllers: [PublicInquiriesController, InquiriesController],
  providers: [InquiriesService],
  exports: [InquiriesService],
})
export class InquiriesModule {}
