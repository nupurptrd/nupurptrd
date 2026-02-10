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

@Entity('platform_settings')
export class PlatformSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'platform_name', nullable: true })
  platformName!: string;

  @Column({
    name: 'default_languages',
    type: 'text',
    array: true,
    nullable: true,
  })
  defaultLanguages!: string[];

  @Column({ name: 'daily_news_enabled', nullable: true, default: false })
  dailyNewsEnabled!: boolean;

  @Column({ name: 'evening_updates_enabled', nullable: true, default: false })
  eveningUpdatesEnabled!: boolean;

  @Column({ name: 'auto_audio_generation', nullable: true, default: false })
  autoAudioGeneration!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToOne(() => User, (user) => user.platformSettings)
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
