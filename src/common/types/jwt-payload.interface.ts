export interface JwtPayload {
  /** User ID (UUID) */
  sub: string;
  email: string;
  /** Role code, e.g. 'admin', 'editor' */
  role: string;
  /** Flat list of permission strings, e.g. ['cars:read', 'cars:write'] */
  permissions: string[];
  /** Incremented on password change / forced logout to invalidate old tokens */
  tokenVersion: number;
  /** JWT ID — unique identifier for this token (used for refresh token rotation) */
  jti: string;
}

export interface RequestUser extends JwtPayload {
  // Merged onto req.user by JwtStrategy.validate()
}
