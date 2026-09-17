import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  HttpException,
  HttpStatus,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { Repository, IsNull, LessThan, Not } from "typeorm";
import { Response } from "express";
import { randomUUID } from "crypto";
import * as bcrypt from "bcryptjs";

import { User, UserStatus } from "../users/entities/user.entity";
import { Role } from "../users/entities/role.entity";
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
import { RedisService } from "../redis/redis.service";

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

    @InjectRepository(LoginOtpToken)
    private readonly otpTokenRepo: Repository<LoginOtpToken>,

    @InjectRepository(PasswordResetToken)
    private readonly pwdResetTokenRepo: Repository<PasswordResetToken>,

    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly redisService: RedisService,
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

    // Explicitly select passwordHash since it has select: false
    const user = await this.userRepo
      .createQueryBuilder("user")
      .addSelect("user.passwordHash")
      .where("user.email = :email", { email: normalized })
      .andWhere("user.deletedAt IS NULL")
      .getOne();

    // Constant-time check to prevent timing attacks
    const dummyHash =
      "$2a$12$e8k8fT9jQ.uT5N5cRkQO5eK8fT9jQ.uT5N5cRkQO5eK8fT9jQ.uT";
    const hashToCompare = user?.passwordHash ?? dummyHash;
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordMatch || user.status !== "ACTIVE") {
      throw new UnauthorizedException("INVALID_CREDENTIALS");
    }

    // Invalidate any existing active OTP challenges for this user
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

    // Send email asynchronously; don't block the HTTP response if mail fails
    this.mailService
      .sendLoginOtp(user.email, otp, user.fullName)
      .catch((err) => {
        // Log in production; do not expose internal mail errors to user
        console.error("Failed to send OTP email:", err);
      });

    return { challengeId: saved.id, expiresAt: saved.expiresAt };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Verify OTP (step 2 of login)
  // ─────────────────────────────────────────────────────────────────────────
  async verifyLoginOtp(
    challengeId: string,
    otp: string,
    deviceId: string,
    ipAddress: string,
    userAgent: string,
    response: Response,
  ): Promise<{ accessToken: string; molToken?: string }> {
    const now = new Date();

    const otpToken = await this.otpTokenRepo.findOne({
      where: {
        id: challengeId,
        usedAt: IsNull(),
      },
    });

    if (!otpToken) {
      throw new UnauthorizedException("LOGIN_OTP_NOT_FOUND");
    }

    if (otpToken.expiresAt <= now) {
      throw new UnauthorizedException("LOGIN_OTP_EXPIRED");
    }

    if (otpToken.attempts >= LOGIN_OTP_MAX_ATTEMPTS) {
      // Mark as used to prevent further attempts
      otpToken.usedAt = now;
      await this.otpTokenRepo.save(otpToken);
      throw new HttpException(
        "LOGIN_OTP_ATTEMPTS_EXCEEDED",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const inputHash = hashToken(otp.trim());
    if (inputHash !== otpToken.codeHash) {
      otpToken.attempts += 1;
      await this.otpTokenRepo.save(otpToken);

      const remaining = LOGIN_OTP_MAX_ATTEMPTS - otpToken.attempts;
      if (remaining <= 0) {
        otpToken.usedAt = now;
        await this.otpTokenRepo.save(otpToken);
        throw new HttpException(
          "LOGIN_OTP_ATTEMPTS_EXCEEDED",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new UnauthorizedException(`INVALID_OTP_${remaining}_ATTEMPTS_LEFT`);
    }

    // OTP is valid — mark as used
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

    // Issue refresh token in Redis (Pure Redis Session)
    const rawRefresh = generateSecureToken(32);
    const tokenHash = hashToken(rawRefresh);
    const ttlSeconds = this.getRefreshTtlSeconds();

    const sessionPayload = {
      userId: user.id,
      deviceId,
      userAgent,
      createdAt: now.toISOString(),
    };

    await this.redisService.set(
      `refresh:${tokenHash}`,
      JSON.stringify(sessionPayload),
      ttlSeconds,
    );
    await this.redisService.set(
      `user_refresh:${user.id}:${tokenHash}`,
      "1",
      ttlSeconds,
    );

    this.setRefreshCookie(response, rawRefresh);

    let molToken: string | undefined;
    if (this.molTokenService) {
      molToken = await this.molTokenService.issue(
        {
          audience: "admin",
          userId: user.id,
          roleCode: user.role?.code ?? "VIEWER",
          permissions: user.role?.permissions?.map((p) => p.code) ?? [],
          tokenVersion: user.tokenVersion,
        },
        deviceId,
      );

      const cookieDomain = this.configService.get<string>("COOKIE_DOMAIN");
      const durationSec =
        this.configService.get<number>("MOL_TOKEN_DURATION_SECONDS") ?? 600;
      response.cookie(MOL_TOKEN_COOKIE, molToken, {
        httpOnly: true,
        secure: this.configService.get<string>("NODE_ENV") === "production",
        sameSite: "strict",
        domain:
          cookieDomain && cookieDomain !== "localhost"
            ? cookieDomain
            : undefined,
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
  // 3. Refresh Access Token (via Redis)
  // ─────────────────────────────────────────────────────────────────────────
  async refreshAccessToken(
    refreshTokenCookie: string,
    deviceId: string,
    userAgent: string,
    response: Response,
  ): Promise<{ accessToken: string }> {
    const tokenHash = hashToken(refreshTokenCookie);
    const sessionRaw = await this.redisService.get(`refresh:${tokenHash}`);

    if (!sessionRaw) {
      throw new UnauthorizedException("REFRESH_TOKEN_INVALID");
    }

    let session: { userId: string; deviceId: string; userAgent: string };
    try {
      session = JSON.parse(sessionRaw);
    } catch {
      throw new UnauthorizedException("REFRESH_TOKEN_INVALID");
    }

    // Token Rotation: Invalidate old token in Redis
    await this.redisService.del(`refresh:${tokenHash}`);
    await this.redisService.del(`user_refresh:${session.userId}:${tokenHash}`);

    // Generate new refresh token in Redis
    const rawNewRefresh = generateSecureToken(32);
    const newTokenHash = hashToken(rawNewRefresh);
    const ttlSeconds = this.getRefreshTtlSeconds();

    const newSessionPayload = {
      userId: session.userId,
      deviceId,
      userAgent,
      createdAt: new Date().toISOString(),
    };

    await this.redisService.set(
      `refresh:${newTokenHash}`,
      JSON.stringify(newSessionPayload),
      ttlSeconds,
    );
    await this.redisService.set(
      `user_refresh:${session.userId}:${newTokenHash}`,
      "1",
      ttlSeconds,
    );

    const user = await this.userRepo.findOne({
      where: { id: session.userId },
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
    const sessionRaw = await this.redisService.get(`refresh:${tokenHash}`);
    if (sessionRaw) {
      try {
        const session = JSON.parse(sessionRaw) as { userId: string };
        await this.redisService.del(
          `user_refresh:${session.userId}:${tokenHash}`,
        );
      } catch {}
      await this.redisService.del(`refresh:${tokenHash}`);
    }

    this.clearRefreshCookie(response);

    const cookieDomain = this.configService.get<string>("COOKIE_DOMAIN");
    response.clearCookie(MOL_TOKEN_COOKIE, {
      domain:
        cookieDomain && cookieDomain !== "localhost" ? cookieDomain : undefined,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Logout All Devices
  // ─────────────────────────────────────────────────────────────────────────
  async logoutAll(userId: string, response: Response): Promise<void> {
    // Revoke all Redis refresh tokens for this user
    const stream = this.redisService.scanStream({
      match: `user_refresh:${userId}:*`,
      count: 100,
    });

    for await (const resultKeys of stream) {
      const keys = resultKeys as string[];
      for (const userKey of keys) {
        const tokenHash = userKey.replace(`user_refresh:${userId}:`, "");
        await this.redisService.del(`refresh:${tokenHash}`, userKey);
      }
    }

    // Revoke all MOLToken Redis sessions
    if (this.molTokenService) {
      await this.molTokenService.revokeAll("admin", userId);
    }

    // Invalidate access tokens by bumping tokenVersion
    await this.userRepo
      .createQueryBuilder()
      .update(User)
      .set({ tokenVersion: () => "token_version + 1" })
      .where("id = :userId", { userId })
      .execute();

    this.clearRefreshCookie(response);

    const cookieDomain = this.configService.get<string>("COOKIE_DOMAIN");
    response.clearCookie(MOL_TOKEN_COOKIE, {
      domain:
        cookieDomain && cookieDomain !== "localhost" ? cookieDomain : undefined,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Request Password Reset
  // ─────────────────────────────────────────────────────────────────────────
  async requestPasswordReset(email: string): Promise<void> {
    const normalized = normalizeEmail(email);
    const user = await this.userRepo.findOne({
      where: { email: normalized, status: UserStatus.ACTIVE },
    });

    // Don't reveal whether the user exists
    if (!user) return;

    // Invalidate existing reset tokens
    await this.pwdResetTokenRepo.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000,
    );

    const resetToken = this.pwdResetTokenRepo.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });
    await this.pwdResetTokenRepo.save(resetToken);

    const frontendUrl =
      this.configService.get<string>("FRONTEND_URL") ?? "http://localhost:3000";
    const resetUrl = `${frontendUrl}/admin/reset-password?token=${rawToken}`;

    await this.mailService.sendPasswordReset(
      user.email,
      resetUrl,
      user.fullName,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Reset Password
  // ─────────────────────────────────────────────────────────────────────────
  async resetPassword(
    rawToken: string,
    newPassword: string,
    response: Response,
  ): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const now = new Date();

    const resetToken = await this.pwdResetTokenRepo.findOne({
      where: { tokenHash, usedAt: IsNull() },
    });

    if (!resetToken || resetToken.expiresAt <= now) {
      throw new UnauthorizedException("PASSWORD_RESET_TOKEN_INVALID");
    }

    const user = await this.userRepo.findOne({
      where: { id: resetToken.userId },
    });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException();
    }

    // Hash and save new password
    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.userRepo.save(user);

    // Invalidate reset token
    resetToken.usedAt = now;
    await this.pwdResetTokenRepo.save(resetToken);

    // Revoke all sessions
    await this.logoutAll(user.id, response);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Change Password (authenticated user)
  // ─────────────────────────────────────────────────────────────────────────
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    response: Response,
  ): Promise<void> {
    const user = await this.userRepo
      .createQueryBuilder("user")
      .addSelect("user.passwordHash")
      .where("user.id = :userId", { userId })
      .andWhere("user.deletedAt IS NULL")
      .getOne();

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
    const days = this.configService.get<number>("REFRESH_TOKEN_TTL_DAYS", 7);
    const maxAge = days * 24 * 60 * 60 * 1000;

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

  private getRefreshTtlSeconds(): number {
    const days = this.configService.get<number>("REFRESH_TOKEN_TTL_DAYS", 7);
    return days * 24 * 60 * 60;
  }
}
