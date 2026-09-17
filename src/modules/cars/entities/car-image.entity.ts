import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Car } from './car.entity';

@Entity('car_images')
export class CarImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Car, (car) => car.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'car_id' })
  car: Relation<Car>;

  @Column({ name: 'public_id' })
  publicId: string;

  @Column()
  url: string;

  @Column({ name: 'secure_url' })
  secureUrl: string;

  @Column({ name: 'alt_text', length: 200, nullable: true })
  altText: string | null;

  @Column({ type: 'int', nullable: true })
  width: number | null;

  @Column({ type: 'int', nullable: true })
  height: number | null;

  @Column({ type: 'int', nullable: true })
  bytes: number | null;

  @Column({ name: 'mime_type', length: 50, nullable: true })
  mimeType: string | null;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ name: 'is_cover', default: false })
  isCover: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
