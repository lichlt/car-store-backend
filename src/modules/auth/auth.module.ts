import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MailService } from './mail.service';
import { MolTokenService } from './mol-token.service';

import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { LoginOtpToken } from './entities/login-otp-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';

import { UsersModule } from '../users/users.module';
import { MolAuthGuard } from '../../common/guards/mol-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      LoginOtpToken,
      PasswordResetToken,
    ]),
    forwardRef(() => UsersModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    MailService,
    MolTokenService,
    MolAuthGuard,
  ],
  exports: [
    AuthService,
    MolTokenService,
    MolAuthGuard,
  ],
})
export class AuthModule {}
