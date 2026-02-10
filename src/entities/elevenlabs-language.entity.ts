import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('elevenlabs_languages')
export class ElevenLabsLanguage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'language_code', unique: true })
  languageCode!: string;

  @Column({ name: 'language_name' })
  languageName!: string;

  @Column({ name: 'voice_count', nullable: true, default: 0 })
  voiceCount!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
