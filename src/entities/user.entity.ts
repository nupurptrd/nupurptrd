import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { UserRole } from './user-role.entity';
import { Profile } from './profile.entity';
import { ApiKey } from './api-key.entity';
import { PlatformSettings } from './platform-settings.entity';
import { NotificationSettings } from './notification-settings.entity';
import { SecuritySettings } from './security-settings.entity';
import { Series } from './series.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  roles!: UserRole[];

  @OneToOne(() => Profile, (profile) => profile.user)
  profile!: Profile;

  @OneToMany(() => ApiKey, (apiKey) => apiKey.user)
  apiKeys!: ApiKey[];

  @OneToOne(() => PlatformSettings, (settings) => settings.user)
  platformSettings!: PlatformSettings;

  @OneToOne(() => NotificationSettings, (settings) => settings.user)
  notificationSettings!: NotificationSettings;

  @OneToOne(() => SecuritySettings, (settings) => settings.user)
  securitySettings!: SecuritySettings;

  @OneToMany(() => Series, (series) => series.createdBy)
  series!: Series[];
}
