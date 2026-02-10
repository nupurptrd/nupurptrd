import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDrmTables1706140800000 implements MigrationInterface {
  name = 'CreateDrmTables1706140800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create drm_licenses table
    await queryRunner.query(`
      CREATE TABLE "drm_licenses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "episode_id" uuid NOT NULL,
        "device_id" character varying,
        "license_type" character varying NOT NULL DEFAULT 'stream',
        "is_valid" boolean NOT NULL DEFAULT true,
        "expires_at" TIMESTAMP,
        "revoked_at" TIMESTAMP,
        "revocation_reason" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_drm_licenses" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_drm_licenses_user_episode" UNIQUE ("user_id", "episode_id")
      )
    `);

    // Create active_streams table
    await queryRunner.query(`
      CREATE TABLE "active_streams" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "episode_id" uuid NOT NULL,
        "device_id" character varying NOT NULL,
        "device_name" character varying,
        "device_platform" character varying,
        "ip_address" character varying,
        "session_token" character varying NOT NULL,
        "last_heartbeat" TIMESTAMP NOT NULL,
        "started_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_active_streams" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_active_streams_session" UNIQUE ("session_token"),
        CONSTRAINT "UQ_active_streams_user_device" UNIQUE ("user_id", "device_id")
      )
    `);

    // Create drm_event_type enum
    await queryRunner.query(`
      CREATE TYPE "drm_event_type_enum" AS ENUM (
        'url_signed',
        'playback_started',
        'playback_ended',
        'playback_validated',
        'playback_rejected',
        'license_granted',
        'license_revoked',
        'concurrent_stream_blocked',
        'download_authorized',
        'download_completed'
      )
    `);

    // Create drm_audit_logs table
    await queryRunner.query(`
      CREATE TABLE "drm_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "episode_id" uuid,
        "device_id" character varying,
        "event_type" "drm_event_type_enum" NOT NULL,
        "ip_address" character varying,
        "user_agent" text,
        "metadata" json,
        "reason" character varying,
        "was_successful" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_drm_audit_logs" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "drm_licenses" 
      ADD CONSTRAINT "FK_drm_licenses_user" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "drm_licenses" 
      ADD CONSTRAINT "FK_drm_licenses_episode" 
      FOREIGN KEY ("episode_id") REFERENCES "series_episodes"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "active_streams" 
      ADD CONSTRAINT "FK_active_streams_user" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "active_streams" 
      ADD CONSTRAINT "FK_active_streams_episode" 
      FOREIGN KEY ("episode_id") REFERENCES "series_episodes"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "drm_audit_logs" 
      ADD CONSTRAINT "FK_drm_audit_logs_user" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "drm_audit_logs" 
      ADD CONSTRAINT "FK_drm_audit_logs_episode" 
      FOREIGN KEY ("episode_id") REFERENCES "series_episodes"("id") ON DELETE SET NULL
    `);

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX "IDX_drm_licenses_user" ON "drm_licenses" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_drm_licenses_episode" ON "drm_licenses" ("episode_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_active_streams_user" ON "active_streams" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_active_streams_heartbeat" ON "active_streams" ("last_heartbeat")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_drm_audit_logs_user_created" ON "drm_audit_logs" ("user_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_drm_audit_logs_event_created" ON "drm_audit_logs" ("event_type", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_drm_audit_logs_event_created"`);
    await queryRunner.query(`DROP INDEX "IDX_drm_audit_logs_user_created"`);
    await queryRunner.query(`DROP INDEX "IDX_active_streams_heartbeat"`);
    await queryRunner.query(`DROP INDEX "IDX_active_streams_user"`);
    await queryRunner.query(`DROP INDEX "IDX_drm_licenses_episode"`);
    await queryRunner.query(`DROP INDEX "IDX_drm_licenses_user"`);

    // Drop foreign keys and tables
    await queryRunner.query(
      `ALTER TABLE "drm_audit_logs" DROP CONSTRAINT "FK_drm_audit_logs_episode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "drm_audit_logs" DROP CONSTRAINT "FK_drm_audit_logs_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "active_streams" DROP CONSTRAINT "FK_active_streams_episode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "active_streams" DROP CONSTRAINT "FK_active_streams_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "drm_licenses" DROP CONSTRAINT "FK_drm_licenses_episode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "drm_licenses" DROP CONSTRAINT "FK_drm_licenses_user"`,
    );

    await queryRunner.query(`DROP TABLE "drm_audit_logs"`);
    await queryRunner.query(`DROP TYPE "drm_event_type_enum"`);
    await queryRunner.query(`DROP TABLE "active_streams"`);
    await queryRunner.query(`DROP TABLE "drm_licenses"`);
  }
}
