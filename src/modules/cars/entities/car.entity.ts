import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CarImage } from './car-image.entity';

export enum CarStatus {
  DRAFT = 'DRAFT',
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  SOLD = 'SOLD',
}

@Entity('cars')
@Index(['status', 'isHidden', 'createdAt'])
@Index(['brandId', 'modelId', 'year'])
export class Car {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'stock_no', length: 50, unique: true, nullable: true })
  stockNo: string | null;

  @Column({ length: 200, unique: true, nullable: true })
  slug: string | null;

  @Column({ name: 'brand_id' })
  brandId: string;

  @Column({ name: 'model_id' })
  modelId: string;

  @Column({ length: 100, default: '' })
  variant: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ name: 'price_cents', type: 'bigint' })
  priceCents: string;

  @Column({ length: 10, default: 'SGD' })
  currency: string;

  @Column({ name: 'coe_cents', type: 'bigint', nullable: true })
  coeCents: string | null;

  @Column({ name: 'omv_cents', type: 'bigint', nullable: true })
  omvCents: string | null;

  @Column({ name: 'arf_cents', type: 'bigint', nullable: true })
  arfCents: string | null;

  @Column({ name: 'engine_cc', type: 'int', nullable: true })
  engineCc: number | null;

  @Column({ name: 'power_kw', type: 'float', nullable: true })
  powerKw: number | null;

  @Column({ name: 'fuel_type', length: 50, nullable: true })
  fuelType: string | null;

  @Column({ length: 50, nullable: true })
  transmission: string | null;

  @Column({ type: 'int', nullable: true })
  seats: number | null;

  @Column({ name: 'mileage_km', type: 'int', nullable: true })
  mileageKm: number | null;

  @Column({ type: 'simple-json', nullable: true })
  colors: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  features: string[] | null;

  @Column({ length: 20, default: 'DRAFT' })
  status: CarStatus;

  @Column({ name: 'is_hidden', default: false })
  isHidden: boolean;

  @Column({ name: 'is_featured', default: false })
  isFeatured: boolean;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'seo_title', length: 200, nullable: true })
  seoTitle: string | null;

  @Column({ name: 'seo_description', length: 500, nullable: true })
  seoDescription: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: Relation<User> | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedBy: Relation<User> | null;

  @OneToMany(() => CarImage, (image) => image.car, { cascade: ['insert', 'update'] })
  images: Relation<CarImage[]>;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
