import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { RedisService } from "../redis/redis.service";

export const MOL_TOKEN_COOKIE = "MOLToken";
const TOKEN_SCHEME = "MOLToken";
const CACHE_PREFIX = "mol:session";

export type MOLTokenAudience = "admin" | "citizen";

export interface MOLTokenData {
  audience: MOLTokenAudience;
  userId: string;
  roleCode: string;
  permissions: string[];
  authLevel: string;
  deviceId: string;
  tokenVersion: number;
  timestamp: number;
}

export interface MOLTokenIdentity {
  audience: MOLTokenAudience;
  userId: string;
  roleCode: string;
  permissions: string[];
  tokenVersion: number;
}

@Injectable()
export class MolTokenService {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  private durationSeconds(): number {
    return this.configService.get<number>("MOL_TOKEN_DURATION_SECONDS") ?? 600;
  }

  private encryptionKey(): Buffer {
    const secret =
      this.configService.get<string>("MOL_TOKEN_ENCRYPTION_SECRET") ??
      "carstore_development_only_change_this_secret_2026";
    return createHash("sha256").update(secret).digest();
  }

  private cacheKey(
    audience: MOLTokenAudience,
    userId: string,
    deviceId: string,
  ): string {
    return `${CACHE_PREFIX}:${audience}:${userId}:${deviceId}`;
  }

  private tokenHash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private hashesMatch(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  encrypt(data: MOLTokenData): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [iv, tag, encrypted]
      .map((part) => part.toString("base64url"))
      .join(".");
  }

  decryptMOLToken(token: string): MOLTokenData {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) throw new Error("Malformed token");
      const [ivPart, tagPart, encryptedPart] = parts;
      if (!ivPart || !tagPart || !encryptedPart)
        throw new Error("Malformed token");

      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.encryptionKey(),
        Buffer.from(ivPart, "base64url"),
      );
      decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedPart, "base64url")),
        decipher.final(),
      ]);

      const data = JSON.parse(
        decrypted.toString("utf8"),
      ) as Partial<MOLTokenData>;
      if (
        (data.audience !== "admin" && data.audience !== "citizen") ||
        typeof data.userId !== "string" ||
        typeof data.roleCode !== "string" ||
        !Array.isArray(data.permissions) ||
        !data.permissions.every((item) => typeof item === "string") ||
        typeof data.authLevel !== "string" ||
        typeof data.deviceId !== "string" ||
        typeof data.tokenVersion !== "number" ||
        typeof data.timestamp !== "number"
      ) {
        throw new Error("Invalid token payload");
      }
      return data as MOLTokenData;
    } catch {
      throw new UnauthorizedException("MOL token is invalid");
    }
  }

  async issue(identity: MOLTokenIdentity, deviceId: string): Promise<string> {
    const data: MOLTokenData = {
      ...identity,
      authLevel: identity.roleCode,
      deviceId,
      timestamp: Math.floor(Date.now() / 1000),
    };
    const token = this.encrypt(data);
    await this.redisService.set(
      this.cacheKey(data.audience, data.userId, data.deviceId),
      JSON.stringify({
        deviceId: data.deviceId,
        tokenHash: this.tokenHash(token),
      }),
      this.durationSeconds(),
    );
    return token;
  }

  async authenticateMOLToken(
    token: string,
    requestDeviceId?: string,
    expectedAudience?: MOLTokenAudience,
  ): Promise<MOLTokenData> {
    const data = this.decryptMOLToken(token);
    if (expectedAudience && data.audience !== expectedAudience) {
      throw new UnauthorizedException("MOL token audience is invalid");
    }
    if (requestDeviceId && requestDeviceId !== data.deviceId) {
      throw new UnauthorizedException(
        "Device id does not match the active token",
      );
    }

    const cached = await this.redisService.get(
      this.cacheKey(data.audience, data.userId, data.deviceId),
    );
    if (!cached) {
      throw new UnauthorizedException("MOL session is not active");
    }

    try {
      const active = JSON.parse(cached) as {
        deviceId?: string;
        tokenHash?: string;
      };
      if (
        active.deviceId !== data.deviceId ||
        typeof active.tokenHash !== "string" ||
        !this.hashesMatch(active.tokenHash, this.tokenHash(token))
      ) {
        throw new Error("Session mismatch");
      }
    } catch {
      throw new UnauthorizedException("MOL session is invalid");
    }

    return data;
  }

  async refresh(data: MOLTokenData): Promise<void> {
    const extended = await this.redisService.expire(
      this.cacheKey(data.audience, data.userId, data.deviceId),
      this.durationSeconds(),
    );
    if (!extended) {
      throw new UnauthorizedException("MOL session is not active");
    }
  }

  async revoke(data: MOLTokenData): Promise<void> {
    await this.redisService.del(
      this.cacheKey(data.audience, data.userId, data.deviceId),
    );
  }

  async revokeAll(audience: MOLTokenAudience, userId: string): Promise<void> {
    const stream = this.redisService.scanStream({
      match: `${CACHE_PREFIX}:${audience}:${userId}:*`,
      count: 100,
    });
    const keys: string[] = [];
    for await (const resultKeys of stream) {
      keys.push(...(resultKeys as string[]));
    }
    if (keys.length > 0) {
      await this.redisService.del(...keys);
    }
  }

  extractAuthorizationToken(
    authHeader: string | undefined,
    tokenScheme: string = TOKEN_SCHEME,
  ): string | null {
    if (!authHeader) return null;
    const [scheme, token, ...unexpectedParts] = authHeader.trim().split(/\s+/);
    if (
      scheme?.toLowerCase() !== tokenScheme.toLowerCase() ||
      !token ||
      unexpectedParts.length > 0
    ) {
      return null;
    }
    return token;
  }

  resolveDeviceId(deviceIdHeader?: string): string {
    return deviceIdHeader?.trim() || randomUUID();
  }
}
