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

export enum BlogStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
}

@Entity("blog_posts")
@Index(["status", "publishedAt"])
export class BlogPost {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 200 })
  title: string;

  @Column({ length: 200, unique: true })
  slug: string;

  @Column({ type: "text" })
  content: string;

  @Column({ type: "text", nullable: true })
  excerpt: string | null;

  @Column({ name: "cover_public_id", type: "varchar", nullable: true })
  coverPublicId: string | null;

  @Column({ name: "cover_url", type: "varchar", nullable: true })
  coverUrl: string | null;

  @Column({ length: 100, nullable: true })
  category: string | null;

  @Column({ type: "simple-array", nullable: true })
  tags: string[] | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "author_id" })
  author: Relation<User> | null;

  @Column({ length: 20, default: "DRAFT" })
  status: BlogStatus;

  @Column({ name: "seo_title", length: 200, nullable: true })
  seoTitle: string | null;

  @Column({ name: "seo_description", length: 500, nullable: true })
  seoDescription: string | null;

  @Column({ name: "published_at", type: "timestamp", nullable: true })
  publishedAt: Date | null;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
