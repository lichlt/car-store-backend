import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  HttpException,
  HttpStatus,
  forwardRef,
  Inject,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { Repository, IsNull, LessThan, Not } from "typeorm";
import { Response } from "express";
import { randomUUID } from "crypto";
import * as bcrypt from "bcryptjs";

import { User } from "../users/entities/user.entity";
import { Role } from "../users/entities/role.entity";
import { RefreshToken } from "./entities/refresh-token.entity";
import { LoginOtpToken } from "./entities/login-otp-token.entity";
import { PasswordResetToken } from "./entities/password-reset-token.entity";
import { JwtPayload } from "../../common/types/jwt-payload.interface";
import { MailService } from "./mail.service";
import {
  hashToken,
  generateOtp,
  generateSecureToken,
  normalizeEmail,
} from "../../common/utils/crypto.utils";
import { REFRESH_TOKEN_COOKIE } from "../../common/constants/app.constants";
import { MolTokenService, MOL_TOKEN_COOKIE } from "./mol-token.service";

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────
const BCRYPT_ROUNDS = 12;
const LOGIN_OTP_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_TTL_MINUTES = 30;

// ──────────────────────────────────────────────────────────────────────────────
// AuthService
// ──────────────────────────────────────────────────────────────────────────────
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,

    @InjectRepository(LoginOtpToken)
    private readonly otpTokenRepo: Repository<LoginOtpToken>,

    @InjectRepository(PasswordResetToken)
    private readonly pwdResetTokenRepo: Repository<PasswordResetToken>,

    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @Optional()
    private readonly molTokenService?: MolTokenService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Request OTP (step 1 of login)
  // ─────────────────────────────────────────────────────────────────────────
  async requestLoginOtp(
    email: string,
    password: string,
  ): Promise<{ challengeId: string; expiresAt: Date }> {
    const normalized = normalizeEmail(email);

    // Select passwordHash explicitly — it is normally excluded via @Column select:false
    const user = await this.userRepo.findOne({
      where: { email: normalized },
      select: ["id", "email", "passwordHash", "status", "deletedAt"],
    });

    // Use a constant-time comparison message to avoid leaking which field is wrong
    const INVALID_MSG = "INVALID_CREDENTIALS";

    if (!user || user.status !== "ACTIVE" || user.deletedAt) {
      // Run a dummy compare to preserve timing parity
      await bcrypt.compare(password, "$2a$12$dummydummydummydummydummydumm");
      throw new UnauthorizedException(INVALID_MSG);
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException(INVALID_MSG);
    }

    // Invalidate any active OTP tokens for this user
    await this.otpTokenRepo
      .createQueryBuilder()
      .update(LoginOtpToken)
      .set({ usedAt: new Date() })
      .where("userId = :userId AND usedAt IS NULL AND expiresAt > :now", {
        userId: user.id,
        now: new Date(),
      })
      .execute();

    // Generate OTP and store it
    const otp = generateOtp();
    const ttlMinutes = this.getOtpTtlMinutes();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const otpToken = this.otpTokenRepo.create({
      userId: user.id,
      codeHash: hashToken(otp),
      expiresAt,
      attempts: 0,
    });
    await this.otpTokenRepo.save(otpToken);

    // Send OTP email — do not catch here so caller gets a 500 if mail is broken
    await this.mailService.sendLoginOtp(user.email, otp);

    return { challengeId: otpToken.id, expiresAt: otpToken.expiresAt };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Verify OTP (step 2 of login → issues tokens)
  // ─────────────────────────────────────────────────────────────────────────
  async verifyLoginOtp(
    challengeId: string,
    otp: string,
    deviceId: string,
    ipAddress: string,
    userAgent: string,
    response: Response,
  ): Promise<{ accessToken: string }> {
    const now = new Date();

    const otpToken = await this.otpTokenRepo.findOne({
      where: {
        id: challengeId,
        usedAt: IsNull(),
      },
    });

    if (!otpToken || otpToken.expiresAt <= now) {
      throw new UnauthorizedException("INVALID_LOGIN_OTP");
    }

    // Check max attempts
    if (otpToken.attempts >= LOGIN_OTP_MAX_ATTEMPTS) {
      otpToken.usedAt = now;
      await this.otpTokenRepo.save(otpToken);
      throw new HttpException(
        "OTP_MAX_ATTEMPTS_EXCEEDED",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Validate the code
    const codeMatches = hashToken(otp) === otpToken.codeHash;
    if (!codeMatches) {
      otpToken.attempts += 1;
      if (otpToken.attempts >= LOGIN_OTP_MAX_ATTEMPTS) {
        otpToken.usedAt = now;
      }
      await this.otpTokenRepo.save(otpToken);
      throw new UnauthorizedException("INVALID_LOGIN_OTP");
    }

    // Mark OTP as consumed
    otpToken.usedAt = now;
    await this.otpTokenRepo.save(otpToken);

    // Load user with role + permissions
    const user = await this.userRepo.findOne({
      where: { id: otpToken.userId },
      relations: ["role", "role.permissions"],
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException();
    }

    // Update lastLoginAt
    user.lastLoginAt = now;
    await this.userRepo.save(user);

    // Issue tokens
    const rawRefresh = generateSecureToken(32);
    const refreshTokenEntity = this.refreshTokenRepo.create({
      userId: user.id,
      tokenHash: hashToken(rawRefresh),
      familyId: randomUUID(),
      deviceId,
      userAgent,
      ipHash: ipAddress ? hashToken(ipAddress) : null,
      expiresAt: this.buildRefreshExpiry(),
    });
    await this.refreshTokenRepo.save(refreshTokenEntity);

    this.setRefreshCookie(response, rawRefresh);

    let molToken: string | undefined;
    if (this.molTokenService) {
      molToken = await this.molTokenService.issue(
        {
          audience: 'admin',
          userId: user.id,
          roleCode: user.role?.code ?? 'VIEWER',
          permissions: user.role?.permissions?.map((p) => p.code) ?? [],
          tokenVersion: user.tokenVersion,
        },
        deviceId,
      );

      const cookieDomain = this.configService.get<string>('COOKIE_DOMAIN');
      const durationSec =
        this.configService.get<number>('MOL_TOKEN_DURATION_SECONDS') ?? 600;
      response.cookie(MOL_TOKEN_COOKIE, molToken, {
        httpOnly: true,
        secure: this.configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'strict',
        domain: cookieDomain && cookieDomain !== 'localhost' ? cookieDomain : undefined,
        maxAge: durationSec * 1000,
      });
    }

    const accessToken = this.buildJwt(user, user.role);
    return {
      accessToken,
      ...(molToken ? { molToken } : {}),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Refresh Access Token
  // ─────────────────────────────────────────────────────────────────────────
  async refreshAccessToken(
    refreshTokenCookie: string,
    deviceId: string,
    userAgent: string,
    response: Response,
  ): Promise<{ accessToken: string }> {
    const tokenHash = hashToken(refreshTokenCookie);

    const storedToken = await this.refreshTokenRepo.findOne({
      where: {
        tokenHash,
        revokedAt: IsNull(),
      },
    });

    if (!storedToken || storedToken.expiresAt <= new Date()) {
      throw new UnauthorizedException("REFRESH_TOKEN_INVALID");
    }

    // Detect token reuse — if this token has already been replaced, revoke the whole family
    if (storedToken.replacedById) {
      await this.revokeFamilyTokens(storedToken.familyId);
      throw new UnauthorizedException("REFRESH_TOKEN_REUSE_DETECTED");
    }

    // Rotate: revoke old, issue new in same family
    const rawNewRefresh = generateSecureToken(32);
    const newTokenEntity = this.refreshTokenRepo.create({
      userId: storedToken.userId,
      tokenHash: hashToken(rawNewRefresh),
      familyId: storedToken.familyId,
      deviceId,
      userAgent,
      ipHash: storedToken.ipHash,
      expiresAt: this.buildRefreshExpiry(),
    });
    await this.refreshTokenRepo.save(newTokenEntity);

    // Mark old token as replaced
    storedToken.revokedAt = new Date();
    storedToken.replacedById = newTokenEntity.id;
    await this.refreshTokenRepo.save(storedToken);

    const user = await this.userRepo.findOne({
      where: { id: storedToken.userId },
      relations: ["role", "role.permissions"],
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException();
    }

    this.setRefreshCookie(response, rawNewRefresh);

    const accessToken = this.buildJwt(user, user.role);
    return { accessToken };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Logout (single device)
  // ─────────────────────────────────────────────────────────────────────────
  async logout(refreshTokenCookie: string, response: Response): Promise<void> {
    const tokenHash = hashToken(refreshTokenCookie);
    const storedToken = await this.refreshTokenRepo.findOne({
      where: { tokenHash, revokedAt: IsNull() },
    });

    if (storedToken) {
      storedToken.revokedAt = new Date();
      await this.refreshTokenRepo.save(storedToken);
    }

    this.clearRefreshCookie(response);

    const cookieDomain = this.configService.get<string>('COOKIE_DOMAIN');
    response.clearCookie(MOL_TOKEN_COOKIE, {
      domain: cookieDomain && cookieDomain !== 'localhost' ? cookieDomain : undefined,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Logout All Devices
  // ─────────────────────────────────────────────────────────────────────────
  async logoutAll(userId: string, response: Response): Promise<void> {
    // Revoke all active refresh tokens for this user
    await this.refreshTokenRepo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('userId = :userId', { userId })
      .andWhere('revokedAt IS NULL')
      .execute();

    // Revoke all Redis sessions
    if (this.molTokenService) {
      await this.molTokenService.revokeAll('admin', userId);
    }

    // Invalidate access tokens by bumping tokenVersion
    await this.userRepo
      .createQueryBuilder()
      .update(User)
      .set({ tokenVersion: () => 'token_version + 1' })
      .where('id = :userId', { userId })
      .execute();

    this.clearRefreshCookie(response);

    const cookieDomain = this.configService.get<string>('COOKIE_DOMAIN');
    response.clearCookie(MOL_TOKEN_COOKIE, {
      domain: cookieDomain && cookieDomain !== 'localhost' ? cookieDomain : undefined,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Request Password Reset
  // ─────────────────────────────────────────────────────────────────────────
  async requestPasswordReset(email: string): Promise<void> {
    const normalized = normalizeEmail(email);
    const user = await this.userRepo.findOne({ where: { email: normalized } });

    // Always respond 200 — never reveal whether the email exists
    if (!user || user.status !== "ACTIVE" || user.deletedAt) return;

    // Invalidate previous reset tokens
    await this.pwdResetTokenRepo
      .createQueryBuilder()
      .update(PasswordResetToken)
      .set({ usedAt: new Date() })
      .where("userId = :userId AND usedAt IS NULL", { userId: user.id })
      .execute();

    const rawToken = generateSecureToken(32);
    const expiresAt = new Date(
      Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000,
    );

    const resetToken = this.pwdResetTokenRepo.create({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt,
    });
    await this.pwdResetTokenRepo.save(resetToken);

    const frontendUrl = this.configService.get<string>(
      "FRONTEND_URL",
      "http://localhost:3000",
    );
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    try {
      await this.mailService.sendPasswordReset(user.email, resetUrl);
    } catch {
      // Silently ignore mail errors so we never reveal user existence
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Reset Password
  // ─────────────────────────────────────────────────────────────────────────
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const now = new Date();

    const resetToken = await this.pwdResetTokenRepo.findOne({
      where: {
        tokenHash,
        usedAt: IsNull(),
      },
    });

    if (!resetToken || resetToken.expiresAt <= now) {
      throw new UnauthorizedException("RESET_TOKEN_INVALID_OR_EXPIRED");
    }

    // Mark reset token as used
    resetToken.usedAt = now;
    await this.pwdResetTokenRepo.save(resetToken);

    const user = await this.userRepo.findOne({
      where: { id: resetToken.userId },
    });
    if (!user) throw new NotFoundException("User not found");

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.userRepo.save(user);

    // Revoke all sessions and bump tokenVersion
    await this.refreshTokenRepo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: now })
      .where("userId = :userId AND revokedAt IS NULL", { userId: user.id })
      .execute();

    await this.userRepo
      .createQueryBuilder()
      .update(User)
      .set({ tokenVersion: () => '"tokenVersion" + 1' })
      .where("id = :id", { id: user.id })
      .execute();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Change Password (authenticated)
  // ─────────────────────────────────────────────────────────────────────────
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    response: Response,
  ): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ["id", "passwordHash", "status"],
    });

    if (!user) throw new NotFoundException("User not found");

    const passwordMatch = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!passwordMatch) {
      throw new UnauthorizedException("CURRENT_PASSWORD_INCORRECT");
    }

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.userRepo.save(user);

    await this.logoutAll(userId, response);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private buildJwt(user: User, role: Role): string {
    const permissionCodes = (role?.permissions ?? []).map((p) => p.code);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: role?.code ?? "",
      permissions: permissionCodes,
      tokenVersion: user.tokenVersion,
      jti: randomUUID(),
    };

    return this.jwtService.sign(payload);
  }

  private setRefreshCookie(response: Response, rawToken: string): void {
    const maxAge =
      this.configService.get<number>("JWT_REFRESH_TTL_DAYS", 30) *
      24 *
      60 *
      60 *
      1000;

    response.cookie(REFRESH_TOKEN_COOKIE, rawToken, {
      httpOnly: true,
      secure: this.configService.get<string>("NODE_ENV") === "production",
      sameSite: "strict",
      path: "/",
      maxAge,
    });
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/" });
  }

  private getOtpTtlMinutes(): number {
    return this.configService.get<number>("LOGIN_OTP_TTL_MINUTES", 10);
  }

  private resolveFamily(familyId?: string): string {
    return familyId ?? randomUUID();
  }

  private buildRefreshExpiry(): Date {
    const days = this.configService.get<number>("JWT_REFRESH_TTL_DAYS", 30);
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private async revokeFamilyTokens(familyId: string): Promise<void> {
    await this.refreshTokenRepo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where("familyId = :familyId AND revokedAt IS NULL", { familyId })
      .execute();
  }
}
