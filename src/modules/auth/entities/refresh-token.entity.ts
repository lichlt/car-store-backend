import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { Relation } from "typeorm";
import { User } from "../../users/entities/user.entity";

@Entity("refresh_tokens")
@Index(["familyId"])
@Index(["expiresAt"])
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id" })
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: Relation<User>;

  /** Groups tokens belonging to the same login session for rotation/revocation. */
  @Column({ name: "family_id" })
  familyId: string;

  @Column({ name: "token_hash", length: 255, unique: true })
  tokenHash: string;

  @Column({ name: "expires_at", type: "timestamp" })
  expiresAt: Date;

  @Column({ name: "revoked_at", type: "timestamp", nullable: true })
  revokedAt: Date | null;

  @Column({ name: "replaced_by_id", type: "varchar", nullable: true })
  replacedById: string | null;

  @Column({ name: "user_agent", length: 500, nullable: true })
  userAgent: string | null;

  @Column({ name: "ip_hash", length: 64, nullable: true })
  ipHash: string | null;

  @Column({ name: "device_id", length: 255, nullable: true })
  deviceId: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
