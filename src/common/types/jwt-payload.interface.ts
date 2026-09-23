import type { MOLTokenData } from "../../modules/auth/mol-token.service";

export interface JwtPayload {
  /** User ID (UUID) */
  sub: string;
  id: string;
  email: string;
  /** Role code, e.g. 'SUPER_ADMIN', 'SALES_STAFF' */
  role: string;
  /** Flat list of permission strings, e.g. ['cars.view', 'cars.create'] */
  permissions: string[];
  /** Incremented on password change / forced logout to invalidate old tokens */
  tokenVersion: number;
  /** Device ID of current session */
  deviceId?: string;
  /** Active session token string */
  token?: string;
  /** Decrypted session payload */
  tokenData?: MOLTokenData;
  /** Optional legacy jti */
  jti?: string;
}

export interface RequestUser extends JwtPayload {}
