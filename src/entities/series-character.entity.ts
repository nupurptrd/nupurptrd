import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Series } from './series.entity';
import { CharacterRoleType } from '../common/enums';

@Entity('series_characters')
export class SeriesCharacter {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'series_id' })
  seriesId!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  age!: string;

  @Column({
    name: 'role_type',
    type: 'enum',
    enum: CharacterRoleType,
    nullable: true,
  })
  roleType!: CharacterRoleType;

  @Column({ name: 'public_mask', nullable: true, type: 'text' })
  publicMask!: string;

  @Column({ name: 'internal_reality', nullable: true, type: 'text' })
  internalReality!: string;

  @Column({ name: 'fatal_flaw', nullable: true, type: 'text' })
  fatalFlaw!: string;

  @Column({ name: 'character_arc', nullable: true, type: 'text' })
  characterArc!: string;

  @Column({ nullable: true, type: 'text' })
  backstory!: string;

  @Column({ name: 'voice_id', nullable: true })
  voiceId!: string;

  @Column({ name: 'voice_name', nullable: true })
  voiceName!: string;

  @Column({ name: 'voice_settings', type: 'jsonb', nullable: true })
  voiceSettings!: Record<string, any>;

  @Column({ name: 'sort_order', nullable: true, default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Series, (series) => series.characters, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'series_id' })
  series!: Series;
}
