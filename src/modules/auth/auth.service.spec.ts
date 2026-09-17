import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AuthService } from "./auth.service";
import { User } from "../users/entities/user.entity";
import { Role } from "../users/entities/role.entity";
import { LoginOtpToken } from "./entities/login-otp-token.entity";
import { PasswordResetToken } from "./entities/password-reset-token.entity";
import { MailService } from "./mail.service";
import { MolTokenService } from "./mol-token.service";

describe("AuthService", () => {
  let service: AuthService;

  const mockUserRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    increment: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockRoleRepo = {
    findOne: jest.fn(),
  };

  const mockOtpRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    increment: jest.fn(),
  };

  const mockResetRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockMolTokenService = {
    issue: jest.fn().mockResolvedValue("mock.mol.token"),
    authenticateMOLToken: jest.fn(),
    refresh: jest.fn(),
    revoke: jest.fn(),
    revokeAll: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const config: Record<string, unknown> = {
        LOGIN_OTP_TTL_MINUTES: 10,
        LOGIN_OTP_MAX_ATTEMPTS: 5,
        COOKIE_DOMAIN: "localhost",
        FRONTEND_URL: "http://localhost:3000",
        MOL_TOKEN_DURATION_SECONDS: 600,
        MOL_TOKEN_ENCRYPTION_SECRET:
          "mock_encryption_secret_at_least_32_characters_long_12345",
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
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
        { provide: getRepositoryToken(LoginOtpToken), useValue: mockOtpRepo },
        {
          provide: getRepositoryToken(PasswordResetToken),
          useValue: mockResetRepo,
        },
        { provide: MolTokenService, useValue: mockMolTokenService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
