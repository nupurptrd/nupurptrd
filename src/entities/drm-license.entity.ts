import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { SeriesEpisode } from './series-episode.entity';

@Entity('drm_licenses')
@Index(['userId', 'episodeId'], { unique: true })
export class DrmLicense {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'episode_id' })
  episodeId!: string;

  @Column({ name: 'device_id', type: 'varchar', nullable: true })
  deviceId!: string | null;

  @Column({ name: 'license_type', default: 'stream' })
  licenseType!: 'stream' | 'download' | 'offline';

  @Column({ name: 'is_valid', default: true })
  isValid!: boolean;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'revocation_reason', type: 'varchar', nullable: true })
  revocationReason!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => SeriesEpisode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'episode_id' })
  episode!: SeriesEpisode;
}
