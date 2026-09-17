import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export interface ActorSnapshot {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

@Entity('activity_logs')
@Index(['module', 'action', 'createdAt'])
@Index(['entityId'])
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Snapshot of the user who performed the action at time of event. */
  @Column({ type: 'simple-json' })
  actor: ActorSnapshot;

  /** e.g. 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT' */
  @Column({ length: 100 })
  action: string;

  /** e.g. 'cars', 'leads', 'users' */
  @Column({ length: 50 })
  module: string;

  @Column({ name: 'entity_id', type: 'varchar', nullable: true })
  entityId: string | null;

  /** Redacted field-level diff — sensitive values must be scrubbed before storage. */
  @Column({ type: 'simple-json', nullable: true })
  diff: Record<string, unknown> | null;

  @Column({ name: 'request_id', type: 'varchar', nullable: true })
  requestId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
