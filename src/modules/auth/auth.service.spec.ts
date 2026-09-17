import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { getRepositoryToken } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { User } from "../users/entities/user.entity";
import { LoginOtpToken } from "./entities/login-otp-token.entity";
import { PasswordResetToken } from "./entities/password-reset-token.entity";
import { MailService } from "./mail.service";
import { RedisService } from "../redis/redis.service";

describe("AuthService", () => {
  let service: AuthService;

  const mockUserRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockOtpRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockResetRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue("mock.jwt.token"),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    expire: jest.fn(),
    scanStream: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const config: Record<string, unknown> = {
        JWT_ACCESS_SECRET: "test-secret-at-least-32-chars-long-here",
        ACCESS_TOKEN_TTL: "15m",
        REFRESH_TOKEN_TTL_DAYS: 7,
        LOGIN_OTP_TTL_MINUTES: 10,
        LOGIN_OTP_MAX_ATTEMPTS: 5,
        COOKIE_DOMAIN: "localhost",
        FRONTEND_URL: "http://localhost:3000",
      };
      return config[key] ?? defaultValue;
    }),
  };

  const mockMailService = {
    sendLoginOtp: jest.fn().mockResolvedValue(undefined),
    sendPasswordReset: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(LoginOtpToken), useValue: mockOtpRepo },
        {
          provide: getRepositoryToken(PasswordResetToken),
          useValue: mockResetRepo,
        },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailService, useValue: mockMailService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
