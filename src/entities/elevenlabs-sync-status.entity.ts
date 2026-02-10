import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('elevenlabs_sync_status')
export class ElevenLabsSyncStatus {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt!: Date;

  @Column({ name: 'last_sort_id', nullable: true })
  lastSortId!: string;

  @Column({ name: 'total_voices_fetched', nullable: true, default: 0 })
  totalVoicesFetched!: number;

  @Column({ name: 'is_complete', nullable: true, default: false })
  isComplete!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
