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
import { Brand } from './brand.entity';

@Entity('vehicle_models')
@Index(['brand', 'isActive'])
@Index(['brandId', 'slug'], { unique: true })
export class VehicleModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Brand, { nullable: false })
  @JoinColumn({ name: 'brand_id' })
  brand: Relation<Brand>;

  /** Populated from the join column — available without loading the relation. */
  @Column({ name: 'brand_id', nullable: false })
  brandId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100 })
  slug: string;

  @Column({ type: 'simple-array', nullable: true })
  variants: string[] | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'spec_template', type: 'simple-json', nullable: true })
  specTemplate: Record<string, unknown> | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
