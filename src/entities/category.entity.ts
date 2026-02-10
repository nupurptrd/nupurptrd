import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { NewsArticle } from './news-article.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true, type: 'text' })
  description!: string;

  @Column({ nullable: true })
  icon!: string;

  @Column({ name: 'parent_id', nullable: true })
  parentId!: string;

  @Column({ type: 'text', array: true, nullable: true })
  languages!: string[];

  @Column({ name: 'preferred_voices', type: 'jsonb', nullable: true })
  preferredVoices!: Record<string, string>;

  @Column({ name: 'is_automated', nullable: true, default: false })
  isAutomated!: boolean;

  @Column({ name: 'automation_status', nullable: true, default: 'stopped' })
  automationStatus!: string;

  @Column({ name: 'is_active', nullable: true, default: true })
  isActive!: boolean;

  @Column({ name: 'sort_order', nullable: true, default: 0 })
  sortOrder!: number;

  @Column({ name: 'last_generated_at', nullable: true })
  lastGeneratedAt!: Date;

  @Column({ name: 'created_by', nullable: true })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Category, (category) => category.children)
  @JoinColumn({ name: 'parent_id' })
  parent!: Category;

  @OneToMany(() => Category, (category) => category.parent)
  children!: Category[];

  @OneToMany(() => NewsArticle, (article) => article.category)
  articles!: NewsArticle[];
}
