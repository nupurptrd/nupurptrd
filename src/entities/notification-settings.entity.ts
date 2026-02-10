import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('notification_settings')
export class NotificationSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'breaking_news', nullable: true, default: true })
  breakingNews!: boolean;

  @Column({ name: 'daily_digest', nullable: true, default: true })
  dailyDigest!: boolean;

  @Column({ name: 'series_episodes', nullable: true, default: true })
  seriesEpisodes!: boolean;

  @Column({ name: 're_engagement', nullable: true, default: false })
  reEngagement!: boolean;

  @Column({ name: 'quiet_hours_start', nullable: true })
  quietHoursStart!: string;

  @Column({ name: 'quiet_hours_end', nullable: true })
  quietHoursEnd!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToOne(() => User, (user) => user.notificationSettings)
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
