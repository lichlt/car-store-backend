import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';

@Injectable()
export class MailService {
  private readonly transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = createTransport({
      host: this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  /**
   * Send a one-time password to the user's email for login verification.
   */
  async sendLoginOtp(
    email: string,
    otp: string,
    fullName?: string,
  ): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ??
      this.configService.get<string>('SMTP_FROM', 'CarStore <noreply@carstore.vn>');
    const greeting = fullName ? `Hello ${fullName},` : 'Hello,';
    const mailOptions: Mail.Options = {
      from,
      to: email,
      subject: '[CarStore] Your Login Verification Code',
      text: [
        greeting,
        '',
        `Your one-time login code is: ${otp}`,
        '',
        'This code expires in 10 minutes. Do not share it with anyone.',
        '',
        'If you did not request this, please ignore this email.',
        '',
        '— CarStore Team',
      ].join('\n'),
    };

    await this.transporter.sendMail(mailOptions);
  }

  /**
   * Send a password-reset link to the user's email.
   */
  async sendPasswordReset(
    email: string,
    resetUrl: string,
    fullName?: string,
  ): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ??
      this.configService.get<string>('SMTP_FROM', 'CarStore <noreply@carstore.vn>');
    const greeting = fullName ? `Hello ${fullName},` : 'Hello,';
    const mailOptions: Mail.Options = {
      from,
      to: email,
      subject: '[CarStore] Reset Your Password',
      text: [
        greeting,
        '',
        'You requested a password reset. Click the link below to set a new password:',
        '',
        resetUrl,
        '',
        'This link expires in 30 minutes. If you did not request a reset, please ignore this email.',
        '',
        '— CarStore Team',
      ].join('\n'),
    };

    await this.transporter.sendMail(mailOptions);
  }
}
