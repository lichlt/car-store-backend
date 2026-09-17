import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('content_pages')
export class ContentPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Unique identifier used by the frontend, e.g. 'about-us', 'homepage'. */
  @Column({ length: 100, unique: true })
  key: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'simple-json' })
  blocks: unknown[];

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ name: 'is_published', default: false })
  isPublished: boolean;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
