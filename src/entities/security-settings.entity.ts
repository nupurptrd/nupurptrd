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

@Entity('security_settings')
export class SecuritySettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'two_factor_enabled', nullable: true, default: false })
  twoFactorEnabled!: boolean;

  @Column({ name: 'session_timeout_enabled', nullable: true, default: false })
  sessionTimeoutEnabled!: boolean;

  @Column({ name: 'session_timeout_minutes', nullable: true, default: 30 })
  sessionTimeoutMinutes!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToOne(() => User, (user) => user.securitySettings)
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
