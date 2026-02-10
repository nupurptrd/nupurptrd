import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { ApiKeyType } from '../common/enums';

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({
    name: 'key_type',
    type: 'enum',
    enum: ApiKeyType,
  })
  keyType!: ApiKeyType;

  @Column({ name: 'api_key' })
  apiKey!: string;

  @Column({ name: 'is_connected', nullable: true, default: false })
  isConnected!: boolean;

  @Column({ name: 'last_verified_at', nullable: true })
  lastVerifiedAt!: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.apiKeys)
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
