import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan } from 'typeorm';
import { Response } from 'express';
import * as bcrypt from 'bcryptjs';

import { User, UserStatus } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { LoginOtpToken } from './entities/login-otp-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { MailService } from './mail.service';
import {
  hashToken,
  generateOtp,
  generateSecureToken,
  normalizeEmail,
} from '../../common/utils/crypto.utils';
import { MolTokenService, MOL_TOKEN_COOKIE } from './mol-token.service';

const LOGIN_OTP_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_TTL_MINUTES = 30;

export function serializeAdmin(user: User): Record<string, unknown> {
  const {
    passwordHash: _p,
    tokenVersion: _t,
    deletedAt: _d,
    ...rest
  } = user as any;
  return rest;
}

export function setMOLTokenCookie(
  res: Response,
  token: string,
  configService: ConfigService,
): void {
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const durationSeconds =
    configService.get<number>('MOL_TOKEN_DURATION_SECONDS') ?? 600;
  const cookieDomain = configService.get<string>('COOKIE_DOMAIN');
  res.cookie(MOL_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    domain: cookieDomain || undefined,
    path: '/api',
    maxAge: durationSeconds * 1000,
  });
}

export function clearMOLTokenCookie(
  res: Response,
  configService: ConfigService,
): void {
  const cookieDomain = configService.get<string>('COOKIE_DOMAIN');
  res.cookie(MOL_TOKEN_COOKIE, '', {
    httpOnly: true,
    path: '/api',
    domain: cookieDomain || undefined,
    maxAge: 0,
  });
}

export interface SessionResult {
  admin: Record<string, unknown>;
  role: string;
  permissions: string[];
  molToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,

    @InjectRepository(LoginOtpToken)
    private readonly otpTokenRepo: Repository<LoginOtpToken>,

    @InjectRepository(PasswordResetToken)
    private readonly pwdResetTokenRepo: Repository<PasswordResetToken>,

    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly molTokenService: MolTokenService,
  ) {}

  private getOtpTtlMinutes(): number {
    return this.configService.get<number>('LOGIN_OTP_TTL_MINUTES', 10);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Request Login OTP
  // ─────────────────────────────────────────────────────────────────────────
  async requestLoginOtp(
    email: string,
    password: string,
  ): Promise<{ challengeId: string; expiresAt: Date }> {
    const normalized = normalizeEmail(email);

    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: normalized })
      .andWhere('user.deletedAt IS NULL')
      .getOne();

    const dummyHash =
      '$2a$12$e8k8fT9jQ.uT5N5cRkQO5eK8fT9jQ.uT5N5cRkQO5eK8fT9jQ.uT';
    const hashToCompare = user?.passwordHash ?? dummyHash;
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordMatch || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Invalidate active OTPs for this user
    await this.otpTokenRepo.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const otp = generateOtp();
    const codeHash = hashToken(otp);
    const ttlMinutes = this.getOtpTtlMinutes();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const challenge = this.otpTokenRepo.create({
      userId: user.id,
      codeHash,
      expiresAt,
    });
    const saved = await this.otpTokenRepo.save(challenge);

    this.mailService.sendLoginOtp(user.email, otp, user.fullName).catch((err) => {
      console.error('Failed to send OTP email:', err);
    });

    return { challengeId: saved.id, expiresAt: saved.expiresAt };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Verify Login OTP & Issue MOLToken
  // ─────────────────────────────────────────────────────────────────────────
  async verifyLoginOtp(
    challengeId: string,
    otp: string,
    deviceId: string,
    res?: Response,
  ): Promise<SessionResult> {
    const now = new Date();

    const otpToken = await this.otpTokenRepo.findOne({
      where: {
        id: challengeId,
        usedAt: IsNull(),
      },
    });

    if (!otpToken) {
      throw new UnauthorizedException('Login code is invalid or expired');
    }

    if (otpToken.expiresAt <= now) {
      throw new UnauthorizedException('Login code is invalid or expired');
    }

    if (otpToken.attempts >= LOGIN_OTP_MAX_ATTEMPTS) {
      otpToken.usedAt = now;
      await this.otpTokenRepo.save(otpToken);
      throw new HttpException(
        'Too many invalid login code attempts',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const codeHash = hashToken(otp);
    if (codeHash !== otpToken.codeHash) {
      await this.otpTokenRepo.increment({ id: otpToken.id }, 'attempts', 1);
      throw new UnauthorizedException('Login code is invalid or expired');
    }

    // Mark challenge as used
    otpToken.usedAt = now;
    await this.otpTokenRepo.save(otpToken);

    // Load full user with role and permissions
    const user = await this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.permissions', 'permission')
      .addSelect('user.tokenVersion')
      .where('user.id = :id', { id: otpToken.userId })
      .andWhere('user.deletedAt IS NULL')
      .getOne();

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Admin is inactive or no longer exists');
    }

    // Update lastLoginAt
    await this.userRepo.update(user.id, { lastLoginAt: now });

    const roleCode = user.role?.code ?? 'VIEWER';
    const permissions = user.role?.permissions
      ? user.role.permissions.map((p) => p.code)
      : [];

    // Issue MOLToken
    const molToken = await this.molTokenService.issue(
      {
        audience: 'admin',
        userId: user.id,
        roleCode,
        permissions,
        tokenVersion: user.tokenVersion,
      },
      deviceId,
    );

    if (res) {
      setMOLTokenCookie(res, molToken, this.configService);
    }

    return {
      admin: serializeAdmin(user),
      role: roleCode,
      permissions,
      molToken,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Resend Login OTP
  // ─────────────────────────────────────────────────────────────────────────
  async resendLoginOtp(
    challengeId: string,
  ): Promise<{ challengeId: string; expiresAt: Date }> {
    const previous = await this.otpTokenRepo.findOne({
      where: { id: challengeId },
    });

    if (!previous) {
      throw new UnauthorizedException('Login code is invalid or expired');
    }

    const user = await this.userRepo.findOne({
      where: { id: previous.userId, status: UserStatus.ACTIVE, deletedAt: IsNull() },
    });

    if (!user) {
      throw new UnauthorizedException('Admin is inactive or no longer exists');
    }

    // Invalidate previous challenge
    previous.usedAt = new Date();
    await this.otpTokenRepo.save(previous);

    const otp = generateOtp();
    const codeHash = hashToken(otp);
    const ttlMinutes = this.getOtpTtlMinutes();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const nextChallenge = this.otpTokenRepo.create({
      userId: user.id,
      codeHash,
      expiresAt,
    });
    const saved = await this.otpTokenRepo.save(nextChallenge);

    this.mailService.sendLoginOtp(user.email, otp, user.fullName).catch((err) => {
      console.error('Failed to resend OTP email:', err);
    });

    return { challengeId: saved.id, expiresAt: saved.expiresAt };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Revoke Sessions (Logout All)
  // ─────────────────────────────────────────────────────────────────────────
  async revokeAllAdminSessions(userId: string): Promise<void> {
    await Promise.all([
      this.molTokenService.revokeAll('admin', userId),
      this.userRepo.increment({ id: userId }, 'tokenVersion', 1),
    ]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Change Password
  // ─────────────────────────────────────────────────────────────────────────
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: userId })
      .andWhere('user.deletedAt IS NULL')
      .getOne();

    if (!user || !(await user.comparePassword(currentPassword))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.save(user);
    await this.revokeAllAdminSessions(user.id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Request Password Reset
  // ─────────────────────────────────────────────────────────────────────────
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: {
        email: normalizeEmail(email),
        status: UserStatus.ACTIVE,
        deletedAt: IsNull(),
      },
    });

    if (!user) return;

    await this.pwdResetTokenRepo.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const raw = generateSecureToken(32);
    const token = this.pwdResetTokenRepo.create({
      userId: user.id,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
    });
    await this.pwdResetTokenRepo.save(token);

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(raw)}`;

    this.mailService
      .sendPasswordReset(user.email, resetUrl, user.fullName)
      .catch((err) => {
        console.error('Password reset email delivery failed:', err);
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Reset Password
  // ─────────────────────────────────────────────────────────────────────────
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const token = await this.pwdResetTokenRepo.findOne({
      where: {
        tokenHash,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!token) {
      throw new HttpException(
        'Password reset token is invalid or expired',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    token.usedAt = new Date();
    await this.pwdResetTokenRepo.save(token);

    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: token.userId })
      .andWhere('user.deletedAt IS NULL')
      .getOne();

    if (!user || user.status !== 'ACTIVE') {
      throw new HttpException(
        'Password reset token is invalid',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.save(user);
    await this.revokeAllAdminSessions(user.id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Authorization & Admin Retrieval Helpers
  // ─────────────────────────────────────────────────────────────────────────
  async getAdminById(id: string): Promise<User> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.permissions', 'permission')
      .where('user.id = :id', { id })
      .andWhere('user.deletedAt IS NULL')
      .getOne();

    if (!user) {
      throw new NotFoundException('Admin not found');
    }

    return user;
  }

  async resolveAuthorization(
    user: User,
  ): Promise<{ roleCode: string; permissions: string[] }> {
    const roleCode = user.role?.code ?? 'VIEWER';
    const permissions = user.role?.permissions
      ? user.role.permissions.map((p) => p.code)
      : [];
    return { roleCode, permissions };
  }
}
