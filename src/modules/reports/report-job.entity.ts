import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ReportJobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

export enum ReportType {
  INVENTORY = 'inventory',
  LEADS = 'leads',
  INQUIRIES = 'inquiries',
  CARS = 'cars',
}

@Entity('report_jobs')
export class ReportJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  type: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ReportJobStatus.PENDING,
  })
  status: ReportJobStatus;

  @Column({ type: 'simple-json', nullable: true })
  filters: Record<string, unknown> | null;

  @Column({ name: 'file_url', type: 'varchar', nullable: true })
  fileUrl: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
