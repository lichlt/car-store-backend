import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Request } from "express";
import { IS_PUBLIC_KEY } from "../constants/app.constants";
import {
  MOL_TOKEN_COOKIE,
  MolTokenService,
} from "../../modules/auth/mol-token.service";
import { User } from "../../modules/users/entities/user.entity";
import { RequestUser } from "../types/jwt-payload.interface";

@Injectable()
export class MolAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly molTokenService: MolTokenService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context
      .switchToHttp()
      .getRequest<
        Request & { user?: RequestUser; admin?: User; tokenData?: unknown }
      >();

    // 1. Extract token from Authorization header or Cookie
    let token: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      token =
        this.molTokenService.extractAuthorizationToken(
          authHeader,
          "MOLToken",
        ) ??
        this.molTokenService.extractAuthorizationToken(authHeader, "Bearer");
    }
    if (!token && req.cookies) {
      token = (req.cookies[MOL_TOKEN_COOKIE] as string) || null;
    }

    if (!token) {
      throw new UnauthorizedException("MOL token is required");
    }

    // 2. Resolve device ID from header
    const rawDeviceId = req.headers["x-device-id"];
    const deviceId =
      typeof rawDeviceId === "string" ? rawDeviceId.trim() : undefined;

    // 3. Authenticate with MOL token service (AES-256-GCM + Redis session check)
    const tokenData = await this.molTokenService.authenticateMOLToken(
      token,
      deviceId || undefined,
      "admin",
    );

    // 4. Verify user existence & active status in database
    const user = await this.userRepo
      .createQueryBuilder("user")
      .addSelect("user.tokenVersion")
      .where("user.id = :id", { id: tokenData.userId })
      .andWhere("user.deletedAt IS NULL")
      .getOne();

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Admin is inactive or no longer exists");
    }

    if (user.tokenVersion !== tokenData.tokenVersion) {
      throw new UnauthorizedException("MOL session is invalid or revoked");
    }

    // 5. Attach user details to request
    const requestUser: RequestUser = {
      sub: user.id,
      id: user.id,
      email: user.email,
      role: tokenData.roleCode,
      permissions: tokenData.permissions,
      tokenVersion: user.tokenVersion,
      deviceId: tokenData.deviceId,
      token,
      tokenData,
    };

    req.user = requestUser;
    req.admin = user;
    req.tokenData = tokenData;

    return true;
  }
}
