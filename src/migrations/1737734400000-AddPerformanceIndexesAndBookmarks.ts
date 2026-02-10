import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexesAndBookmarks1737734400000 implements MigrationInterface {
  name = 'AddPerformanceIndexesAndBookmarks1737734400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create bookmarks table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bookmarks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "series_id" uuid NOT NULL,
        "episode_id" uuid NOT NULL,
        "position_seconds" integer NOT NULL,
        "duration_seconds" integer,
        "note" text,
        "title" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bookmarks_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bookmarks_user_episode_position" UNIQUE ("user_id", "episode_id", "position_seconds")
      )
    `);

    // Add foreign keys for bookmarks
    await queryRunner.query(`
      ALTER TABLE "bookmarks"
      ADD CONSTRAINT "FK_bookmarks_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "bookmarks"
      ADD CONSTRAINT "FK_bookmarks_series" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "bookmarks"
      ADD CONSTRAINT "FK_bookmarks_episode" FOREIGN KEY ("episode_id") REFERENCES "series_episodes"("id") ON DELETE CASCADE
    `);

    // Add indexes for bookmarks
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bookmarks_user_id" ON "bookmarks" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bookmarks_user_series" ON "bookmarks" ("user_id", "series_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bookmarks_user_episode" ON "bookmarks" ("user_id", "episode_id")`,
    );

    // Performance indexes for series table
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_series_status" ON "series" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_series_created_at" ON "series" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_series_updated_at" ON "series" ("updated_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_series_primary_genre" ON "series" ("primary_genre")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_series_language" ON "series" ("language")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_series_status_created" ON "series" ("status", "created_at")`,
    );

    // Performance indexes for series_episodes table
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_episodes_series_id" ON "series_episodes" ("series_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_episodes_status" ON "series_episodes" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_episodes_series_status" ON "series_episodes" ("series_id", "status")`,
    );

    // Performance indexes for news_articles table
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_news_status" ON "news_articles" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_news_published_at" ON "news_articles" ("published_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_news_created_at" ON "news_articles" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_news_category_id" ON "news_articles" ("category_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_news_status_published" ON "news_articles" ("status", "published_at")`,
    );

    // Performance indexes for playback_positions table
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_playback_user_id" ON "playback_positions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_playback_series_id" ON "playback_positions" ("series_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_playback_episode_id" ON "playback_positions" ("episode_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_playback_updated_at" ON "playback_positions" ("updated_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_playback_user_completed" ON "playback_positions" ("user_id", "is_completed")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_playback_user_progress" ON "playback_positions" ("user_id", "progress_percent")`,
    );

    // Performance indexes for categories table
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_categories_parent_id" ON "categories" ("parent_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_categories_is_active" ON "categories" ("is_active")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop bookmarks table and constraints
    await queryRunner.query(`DROP TABLE IF EXISTS "bookmarks"`);

    // Drop series indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_series_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_series_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_series_updated_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_series_primary_genre"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_series_language"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_series_status_created"`);

    // Drop episode indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_episodes_series_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_episodes_status"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_episodes_series_status"`,
    );

    // Drop news indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_news_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_news_published_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_news_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_news_category_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_news_status_published"`);

    // Drop playback indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_playback_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_playback_series_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_playback_episode_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_playback_updated_at"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_playback_user_completed"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_playback_user_progress"`,
    );

    // Drop category indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_categories_parent_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_categories_is_active"`);
  }
}
