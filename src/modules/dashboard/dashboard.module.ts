import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Car } from '../cars/entities/car.entity';
import { Lead } from '../leads/entities/lead.entity';
import { Inquiry } from '../inquiries/entities/inquiry.entity';
import { ActivityLog } from '../audit/entities/activity-log.entity';

import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Car, Lead, Inquiry, ActivityLog])],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
