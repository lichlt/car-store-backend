import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUOTED = 'QUOTED',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

export interface NoteEntry {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface CommunicationEntry {
  channel: string;
  summary: string;
  actorId: string;
  actorName: string;
  occurredAt: string;
}

export interface StatusHistoryEntry {
  from: LeadStatus;
  to: LeadStatus;
  actorId: string;
  actorName: string;
  reason: string;
  at: string;
}

export interface CarInfo {
  brand?: string;
  model?: string;
  year?: number;
  licensePlate?: string;
  condition?: string;
  mileage?: number;
  expectedPriceCents?: number;
}

export interface ContactInfo {
  name?: string;
  phone?: string;
  email?: string;
  preferredContact?: string;
}

@Entity('leads')
@Index(['status', 'createdAt'])
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reference_no', length: 50, unique: true })
  referenceNo: string;

  @Column({ name: 'car_info', type: 'simple-json', nullable: true })
  carInfo: CarInfo | null;

  @Column({ type: 'simple-json', nullable: true })
  contact: ContactInfo | null;

  @Column({ type: 'simple-json', nullable: true })
  images: string[] | null;

  @Column({ length: 50, nullable: true })
  source: string | null;

  @Column({ length: 20, default: 'NEW' })
  status: LeadStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  assignedTo: Relation<User> | null;

  @Column({ name: 'quoted_price_cents', type: 'bigint', nullable: true })
  quotedPriceCents: string | null;

  @Column({ type: 'simple-json', default: '[]' })
  notes: NoteEntry[];

  @Column({ type: 'simple-json', default: '[]' })
  communications: CommunicationEntry[];

  @Column({ name: 'status_history', type: 'simple-json', default: '[]' })
  statusHistory: StatusHistoryEntry[];

  @Column({ name: 'next_follow_up_at', type: 'timestamp', nullable: true })
  nextFollowUpAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
