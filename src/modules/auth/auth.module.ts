import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MailService } from './mail.service';

import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginOtpToken } from './entities/login-otp-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';

import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    // Repositories
    TypeOrmModule.forFeature([User, RefreshToken, LoginOtpToken, PasswordResetToken]),

    // Passport defaults to 'jwt' strategy
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JWT — async so ConfigService is available
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_TTL', '15m'),
        },
      }),
    }),

    // forwardRef avoids circular dependency: AuthModule ↔ UsersModule
    forwardRef(() => UsersModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, MailService],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
