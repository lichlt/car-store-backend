import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";
import type { Readable } from "node:stream";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const redisUrl =
      this.configService.get<string>("REDIS_URL") ?? "redis://localhost:6379";

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
    });

    this.client.on("error", (err) => {
      this.logger.warn(`Redis connection error: ${(err as Error).message}`);
    });

    // Connect asynchronously without blocking bootstrap if Redis is temporarily offline
    this.client
      .connect()
      .then(() => {
        this.logger.log("Redis connected successfully");
      })
      .catch((err) => {
        this.logger.warn(
          `Redis could not connect on startup (${(err as Error).message}). Will reconnect when available.`,
        );
      });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && this.client.status !== "end") {
      await this.client.quit();
      this.logger.log("Redis disconnected gracefully");
    }
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (err) {
      this.logger.warn(
        `Redis GET failed for key "${key}": ${(err as Error).message}`,
      );
      return null;
    }
  }

  async set(
    key: string,
    value: string,
    seconds?: number,
  ): Promise<"OK" | null> {
    try {
      if (seconds) {
        return await this.client.set(key, value, "EX", seconds);
      }
      return await this.client.set(key, value);
    } catch (err) {
      this.logger.warn(
        `Redis SET failed for key "${key}": ${(err as Error).message}`,
      );
      return null;
    }
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    try {
      return await this.client.del(...keys);
    } catch (err) {
      this.logger.warn(`Redis DEL failed: ${(err as Error).message}`);
      return 0;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (err) {
      this.logger.warn(
        `Redis EXPIRE failed for key "${key}": ${(err as Error).message}`,
      );
      return false;
    }
  }

  scanStream(options?: { match?: string; count?: number }): Readable {
    return this.client.scanStream(options);
  }
}
