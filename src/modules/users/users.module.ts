import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';

import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, Permission]),
    // forwardRef breaks the circular dependency: UsersModule → AuthModule → UsersModule
    forwardRef(() => AuthModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  // Export TypeOrmModule so AuthModule can use the User repository without
  // registering it again, and export UsersService for optional future use.
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
