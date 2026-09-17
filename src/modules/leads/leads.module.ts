import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Lead } from './entities/lead.entity';
import { User } from '../users/entities/user.entity';
import { LeadsService } from './leads.service';
import { LeadsController, PublicLeadsController } from './leads.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Lead, User])],
  controllers: [PublicLeadsController, LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
