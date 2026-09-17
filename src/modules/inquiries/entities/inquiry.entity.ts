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
} from "typeorm";
import type { Relation } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Car } from "../../cars/entities/car.entity";
import type {
  NoteEntry,
  StatusHistoryEntry,
} from "../../leads/entities/lead.entity";

export enum InquiryType {
  CONTACT = "CONTACT",
  TEST_DRIVE = "TEST_DRIVE",
  FINANCING = "FINANCING",
  SERVICE = "SERVICE",
}

export enum InquiryStatus {
  NEW = "NEW",
  CONTACTED = "CONTACTED",
  PROCESSING = "PROCESSING",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
}

export interface InquiryContact {
  name?: string;
  phone?: string;
  email?: string;
  message?: string;
}

@Entity("inquiries")
@Index(["status", "createdAt"])
export class Inquiry {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "reference_no", length: 50, unique: true })
  referenceNo: string;

  @Column({ length: 30 })
  type: InquiryType;

  @ManyToOne(() => Car, { nullable: true })
  @JoinColumn({ name: "car_id" })
  car: Relation<Car> | null;

  @Column({ type: "simple-json", nullable: true })
  contact: InquiryContact | null;

  @Column({ name: "preferred_date", type: "timestamp", nullable: true })
  preferredDate: Date | null;

  @Column({ length: 30, default: "NEW" })
  status: InquiryStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "assigned_to" })
  assignedTo: Relation<User> | null;

  @Column({ type: "simple-json", default: "[]" })
  notes: NoteEntry[];

  @Column({ name: "status_history", type: "simple-json", default: "[]" })
  statusHistory: StatusHistoryEntry[];

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
