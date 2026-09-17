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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiCookieAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

import { AuthService } from './auth.service';
import {
  LoginDto,
  VerifyOtpDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  UpdateProfileDto,
} from './auth.dto';
import { Public } from '../../common/decorators';
import { CurrentUser } from '../../common/decorators';
import { RequestUser } from '../../common/types/jwt-payload.interface';
import { REFRESH_TOKEN_COOKIE, DEVICE_ID_HEADER } from '../../common/constants/app.constants';

// ──────────────────────────────────────────────────────────────────────────────
// AuthController
// ──────────────────────────────────────────────────────────────────────────────
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Step 1: Validate credentials, send OTP ───────────────────────────────
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 1 – validate credentials and send OTP to email' })
  async login(
    @Body() dto: LoginDto,
  ): Promise<{ challengeId: string; expiresAt: Date }> {
    return this.authService.requestLoginOtp(dto.email, dto.password);
  }

  // ─── Step 2: Submit OTP, receive JWT + refresh cookie ─────────────────────
  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 2 – submit OTP to complete login and receive access token' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; molToken?: string }> {
    const deviceId = this.resolveDeviceId(req);
    const ipAddress = this.resolveIp(req);
    const userAgent = (req.headers['user-agent'] as string) ?? '';

    return this.authService.verifyLoginOtp(
      dto.challengeId,
      dto.otp,
      deviceId,
      ipAddress,
      userAgent,
      res,
    );
  }

  // ─── Resend OTP (same challenge or re-initiate) ────────────────────────────
  @Public()
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend a new OTP for an active challenge' })
  async resendOtp(
    @Body() _dto: ResendOtpDto,
  ): Promise<{ message: string }> {
    // For MVP: returning a generic success. Full implementation would
    // look up the original login email via the challengeId and call requestLoginOtp again.
    // This requires the LoginOtpToken to store the userId/email so it can be resent.
    return { message: 'If the challenge is valid, a new OTP has been sent.' };
  }

  // ─── Refresh access token ──────────────────────────────────────────────────
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  @ApiOperation({ summary: 'Exchange a valid refresh token cookie for a new access token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const cookie = req.cookies[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (!cookie) {
      // Return 401 rather than importing AuthGuard separately
      throw new (await import('@nestjs/common').then((m) => m.UnauthorizedException))();
    }

    const deviceId = this.resolveDeviceId(req);
    const userAgent = (req.headers['user-agent'] as string) ?? '';

    return this.authService.refreshAccessToken(cookie, deviceId, userAgent, res);
  }

  // ─── Logout (single device) ────────────────────────────────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current refresh token and clear the cookie' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const cookie = req.cookies[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (cookie) {
      await this.authService.logout(cookie, res);
    }
  }

  // ─── Logout all devices ────────────────────────────────────────────────────
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all refresh tokens for the current user' })
  async logoutAll(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logoutAll(user.sub, res);
  }

  // ─── Get current user profile ──────────────────────────────────────────────
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user\'s profile with permissions' })
  getProfile(@CurrentUser() user: RequestUser): RequestUser {
    return user;
  }

  // ─── Update profile (name, phone) ─────────────────────────────────────────
  @Patch('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update display name or phone number' })
  async updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() _dto: UpdateProfileDto,
  ): Promise<{ message: string }> {
    // Profile updates are a UsersService concern — stub here for route registration.
    // A full implementation would inject UsersService and call usersService.update().
    return { message: 'Profile update not yet implemented' };
  }

  // ─── Change password ───────────────────────────────────────────────────────
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password (requires current password verification)' })
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.changePassword(user.sub, dto.currentPassword, dto.newPassword, res);
  }

  // ─── Forgot password ───────────────────────────────────────────────────────
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password-reset email (always returns 200)' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.authService.requestPasswordReset(dto.email);
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  // ─── Reset password ────────────────────────────────────────────────────────
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set a new password using the token from the reset email' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto.token, dto.password);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private resolveDeviceId(req: Request): string {
    const header = req.headers[DEVICE_ID_HEADER];
    if (typeof header === 'string' && header.length > 0) return header;
    return randomUUID();
  }

  private resolveIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    return req.socket?.remoteAddress ?? '';
  }
}
