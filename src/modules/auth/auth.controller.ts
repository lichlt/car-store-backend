import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  AuthService,
  clearMOLTokenCookie,
  serializeAdmin,
  setMOLTokenCookie,
} from './auth.service';
import {
  LoginDto,
  VerifyOtpDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  UpdateProfileDto,
} from './auth.dto';
import { Public, CurrentUser } from '../../common/decorators';
import { RequestUser } from '../../common/types/jwt-payload.interface';
import { MolTokenService, MOL_TOKEN_COOKIE } from './mol-token.service';
import { User } from '../users/entities/user.entity';

@ApiTags('Auth')
@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly molTokenService: MolTokenService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private resolveDeviceId(req: Request): string {
    const raw = req.headers['x-device-id'];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
    return this.molTokenService.resolveDeviceId();
  }

  // ─── Step 1: Validate credentials, send OTP ───────────────────────────────
  @Public()
  @Post(['login', 'auth/login'])
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Step 1 – validate credentials and send OTP to email',
  })
  async login(
    @Body() dto: LoginDto,
  ): Promise<{ challengeId: string; expiresAt: Date }> {
    return this.authService.requestLoginOtp(dto.email, dto.password);
  }

  // ─── Step 2: Submit OTP, receive MOLToken ────────────────────────────────
  @Public()
  @Post(['verify-login-otp', 'auth/verify-login-otp', 'auth/verify-otp'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Step 2 – submit OTP to complete login and receive MOLToken session',
  })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const deviceId = this.resolveDeviceId(req);
    return this.authService.verifyLoginOtp(
      dto.challengeId,
      dto.otp,
      deviceId,
      res,
    );
  }

  // ─── Resend OTP ──────────────────────────────────────────────────────────
  @Public()
  @Post(['resend-login-otp', 'auth/resend-login-otp', 'auth/resend-otp'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend a new OTP for an active challenge' })
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendLoginOtp(dto.challengeId);
  }

  // ─── Refresh MOLToken session ────────────────────────────────────────────
  @Post(['refresh-token', 'auth/refresh-token', 'auth/refresh'])
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('MOLToken')
  @ApiOperation({
    summary: 'Extend active MOLToken session in Redis and reset cookie',
  })
  async refresh(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ molToken: string }> {
    const token =
      user.token ??
      this.molTokenService.extractAuthorizationToken(req.headers.authorization) ??
      (req.cookies?.[MOL_TOKEN_COOKIE] as string | undefined);

    if (!user.tokenData || !token) {
      clearMOLTokenCookie(res, this.configService);
      throw new UnauthorizedException('MOL token is required');
    }

    await this.molTokenService.refresh(user.tokenData);
    setMOLTokenCookie(res, token, this.configService);
    return { molToken: token };
  }

  // ─── Logout (single device) ──────────────────────────────────────────────
  @Public()
  @Post(['logout', 'auth/logout'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke active MOL session on Redis and clear cookie',
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const token =
      this.molTokenService.extractAuthorizationToken(req.headers.authorization) ??
      (req.cookies?.[MOL_TOKEN_COOKIE] as string | undefined);

    if (token) {
      try {
        const tokenData = this.molTokenService.decryptMOLToken(token);
        await this.molTokenService.revoke(tokenData);
      } catch {
        // Ignore decryption errors on logout
      }
    }

    clearMOLTokenCookie(res, this.configService);
    return { message: 'Logged out successfully' };
  }

  // ─── Logout all devices ──────────────────────────────────────────────────
  @Post(['logout-all', 'auth/logout-all'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Revoke all sessions for this user across all devices',
  })
  async logoutAll(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.authService.revokeAllAdminSessions(user.id);
    clearMOLTokenCookie(res, this.configService);
    return { message: 'All sessions have been revoked' };
  }

  // ─── Get current profile ─────────────────────────────────────────────────
  @Get(['profile', 'auth/profile'])
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  async getProfile(@CurrentUser() user: RequestUser) {
    const admin = await this.authService.getAdminById(user.id);
    const auth = await this.authService.resolveAuthorization(admin);
    return {
      admin: serializeAdmin(admin),
      role: auth.roleCode,
      permissions: auth.permissions,
    };
  }

  // ─── Update profile ──────────────────────────────────────────────────────
  @Patch(['profile', 'auth/profile'])
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update profile for the authenticated admin' })
  async updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const admin = await this.authService.getAdminById(user.id);
    if (dto.fullName !== undefined) admin.fullName = dto.fullName;
    if (dto.avatarUrl !== undefined) admin.avatarUrl = dto.avatarUrl;
    if (dto.phone !== undefined) admin.phone = dto.phone;

    const saved = await this.userRepo.save(admin);
    return {
      admin: serializeAdmin(saved),
      message: 'Profile updated',
    };
  }

  // ─── Change password ─────────────────────────────────────────────────────
  @Post(['change-password', 'auth/change-password'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for the authenticated admin' })
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    clearMOLTokenCookie(res, this.configService);
    return { message: 'Password changed; please sign in again' };
  }

  // ─── Forgot password ─────────────────────────────────────────────────────
  @Public()
  @Post(['forgot-password', 'auth/forgot-password'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset instructions via email' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.requestPasswordReset(dto.email);
    return {
      message:
        'If the account exists, password reset instructions have been sent',
    };
  }

  // ─── Reset password ──────────────────────────────────────────────────────
  @Public()
  @Post(['reset-password', 'auth/reset-password'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using an email token' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const newPassword = dto.newPassword || dto.password;
    if (!newPassword) {
      throw new UnauthorizedException('New password is required');
    }
    await this.authService.resetPassword(dto.token, newPassword);
    clearMOLTokenCookie(res, this.configService);
    return { message: 'Password reset successfully; please sign in' };
  }
}
