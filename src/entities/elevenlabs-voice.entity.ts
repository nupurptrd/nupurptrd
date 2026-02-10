import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('elevenlabs_voices')
export class ElevenLabsVoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'voice_id', unique: true })
  voiceId!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  category!: string;

  @Column({ nullable: true })
  language!: string;

  @Column({ nullable: true })
  accent!: string;

  @Column({ nullable: true })
  gender!: string;

  @Column({ nullable: true })
  age!: string;

  @Column({ nullable: true, type: 'text' })
  description!: string;

  @Column({ name: 'preview_url', nullable: true })
  previewUrl!: string;

  @Column({ type: 'jsonb', nullable: true })
  labels!: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
