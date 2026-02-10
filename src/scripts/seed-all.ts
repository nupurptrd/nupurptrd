import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import { parse } from 'csv-parse/sync';

const backupPath = path.join(__dirname, '../../../smarton-content/backup');

function cleanValue(val: string | undefined | null): string | null {
  if (!val || val === '' || val === 'null') return null;
  return val;
}

function parseArray(val: string | undefined): string[] | null {
  if (!val || val === '' || val === '{}') return null;
  try {
    return JSON.parse(val.replace(/'/g, '"'));
  } catch {
    return val
      .replace(/[\[\]"{}]/g, '')
      .split(',')
      .filter((v) => v.trim());
  }
}

function parseCSVFile(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  try {
    return parse(content, {
      columns: true,
      delimiter: ';',
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: true,
      quote: '"',
    });
  } catch (e) {
    console.error(`Error parsing ${filePath}:`, e);
    return [];
  }
}

async function seed() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: process.env.DATABASE_USER || 'deepparmar',
    password: process.env.DATABASE_PASSWORD || '',
    database: 'smarton_content',
  });

  await client.connect();
  console.log('🌱 Starting comprehensive database seed...\n');

  try {
    // Get default user
    const userResult = await client.query(`SELECT id FROM users LIMIT 1`);
    let defaultUserId = userResult.rows[0]?.id;

    if (!defaultUserId) {
      console.log('Creating default admin user...');
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const newUser = await client.query(
        `INSERT INTO users (id, email, password, created_at, updated_at) 
         VALUES (gen_random_uuid(), 'admin@smarton.com', $1, NOW(), NOW()) RETURNING id`,
        [hashedPassword],
      );
      defaultUserId = newUser.rows[0].id;
      await client.query(
        `INSERT INTO profiles (id, user_id, email, full_name, created_at, updated_at) 
         VALUES (gen_random_uuid(), $1, 'admin@smarton.com', 'Admin User', NOW(), NOW())`,
        [defaultUserId],
      );
      await client.query(
        `INSERT INTO user_roles (id, user_id, role, created_at) 
         VALUES (gen_random_uuid(), $1, 'super_admin', NOW())`,
        [defaultUserId],
      );
    }

    // 1. Seed Series
    console.log('🎬 Seeding Series...');
    const seriesFile = fs
      .readdirSync(backupPath)
      .find((f) => f.startsWith('series-'));
    if (seriesFile) {
      const records = parseCSVFile(path.join(backupPath, seriesFile));
      let count = 0;
      for (const row of records) {
        if (!row.id || row.id.length !== 36) continue;
        try {
          const themes = parseArray(row.themes);
          await client.query(
            `INSERT INTO series (id, created_by, title, logline, format, primary_genre, secondary_genre, comps, abstract, world_setting, themes, visual_style, music_soundscape, central_mystery, future_seasons, pilot_synopsis, season_arc, status, language, episode_count, episode_duration_minutes, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) ON CONFLICT (id) DO NOTHING`,
            [
              row.id,
              defaultUserId,
              row.title,
              cleanValue(row.logline),
              cleanValue(row.format),
              cleanValue(row.primary_genre),
              cleanValue(row.secondary_genre),
              cleanValue(row.comps),
              cleanValue(row.abstract),
              cleanValue(row.world_setting),
              themes,
              cleanValue(row.visual_style),
              cleanValue(row.music_soundscape),
              cleanValue(row.central_mystery),
              cleanValue(row.future_seasons),
              cleanValue(row.pilot_synopsis),
              cleanValue(row.season_arc),
              row.status || 'draft',
              cleanValue(row.language),
              parseInt(row.episode_count) || null,
              parseInt(row.episode_duration_minutes) || null,
              row.created_at || new Date().toISOString(),
              row.updated_at || new Date().toISOString(),
            ],
          );
          count++;
        } catch (e: any) {
          // Skip errors
        }
      }
      console.log(`  ✅ Seeded ${count} series\n`);
    }

    // 2. Seed Characters
    console.log('👤 Seeding Characters...');
    const charactersFile = fs
      .readdirSync(backupPath)
      .find((f) => f.includes('series_characters'));
    if (charactersFile) {
      const records = parseCSVFile(path.join(backupPath, charactersFile));
      let count = 0;
      for (const row of records) {
        if (!row.id || row.id.length !== 36) continue;
        try {
          let voiceSettings = null;
          if (row.voice_settings && row.voice_settings !== '{}') {
            try {
              voiceSettings = JSON.parse(row.voice_settings.replace(/'/g, '"'));
            } catch {}
          }
          await client.query(
            `INSERT INTO series_characters (id, series_id, name, age, role_type, public_mask, internal_reality, fatal_flaw, character_arc, backstory, voice_id, voice_name, voice_settings, sort_order, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) ON CONFLICT (id) DO NOTHING`,
            [
              row.id,
              row.series_id,
              row.name,
              cleanValue(row.age),
              cleanValue(row.role_type),
              cleanValue(row.public_mask),
              cleanValue(row.internal_reality),
              cleanValue(row.fatal_flaw),
              cleanValue(row.character_arc),
              cleanValue(row.backstory),
              cleanValue(row.voice_id),
              cleanValue(row.voice_name),
              voiceSettings ? JSON.stringify(voiceSettings) : null,
              parseInt(row.sort_order) || 0,
              row.created_at || new Date().toISOString(),
              row.updated_at || new Date().toISOString(),
            ],
          );
          count++;
        } catch (e: any) {
          // Skip errors
        }
      }
      console.log(`  ✅ Seeded ${count} characters\n`);
    }

    // 3. Seed Episodes
    console.log('📺 Seeding Episodes...');
    const episodesFile = fs
      .readdirSync(backupPath)
      .find((f) => f.includes('series_episodes'));
    if (episodesFile) {
      const records = parseCSVFile(path.join(backupPath, episodesFile));
      let count = 0;
      for (const row of records) {
        if (!row.id || row.id.length !== 36) continue;
        try {
          await client.query(
            `INSERT INTO series_episodes (id, series_id, episode_number, title, synopsis, generation_prompt, full_script, formatted_audio_script, audio_url, duration_seconds, status, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) ON CONFLICT (id) DO NOTHING`,
            [
              row.id,
              row.series_id,
              parseInt(row.episode_number) || 1,
              row.title || 'Untitled',
              cleanValue(row.synopsis),
              cleanValue(row.generation_prompt),
              cleanValue(row.full_script),
              cleanValue(row.formatted_audio_script),
              cleanValue(row.audio_url),
              parseInt(row.duration_seconds) || null,
              row.status || 'outline',
              row.created_at || new Date().toISOString(),
              row.updated_at || new Date().toISOString(),
            ],
          );
          count++;
        } catch (e: any) {
          // Skip errors
        }
      }
      console.log(`  ✅ Seeded ${count} episodes\n`);
    }

    // 4. Seed News Articles
    console.log('📰 Seeding News Articles...');
    const newsFile = fs
      .readdirSync(backupPath)
      .find((f) => f.includes('news_articles'));
    if (newsFile) {
      const records = parseCSVFile(path.join(backupPath, newsFile));
      let count = 0;
      for (const row of records) {
        if (!row.id || row.id.length !== 36) continue;
        try {
          const tags = parseArray(row.tags);
          const emotionTags = parseArray(row.emotion_tags);
          let voiceSettings = null;
          if (row.voice_settings && row.voice_settings !== '{}') {
            try {
              voiceSettings = JSON.parse(row.voice_settings.replace(/'/g, '"'));
            } catch {}
          }
          await client.query(
            `INSERT INTO news_articles (id, category_id, title, content, summary, language, article_type, locality_focus, tags, emotion_tags, suggested_emotion, formatted_script, voice_id, voice_name, voice_settings, audio_url, s3_key, status, generated_at, published_at, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) ON CONFLICT (id) DO NOTHING`,
            [
              row.id,
              cleanValue(row.category_id),
              row.title || 'Untitled',
              row.content || '',
              cleanValue(row.summary),
              row.language || 'English',
              row.article_type || 'detailed',
              cleanValue(row.locality_focus),
              tags,
              emotionTags,
              cleanValue(row.suggested_emotion),
              cleanValue(row.formatted_script),
              cleanValue(row.voice_id),
              cleanValue(row.voice_name),
              voiceSettings ? JSON.stringify(voiceSettings) : null,
              cleanValue(row.audio_url),
              cleanValue(row.s3_key),
              row.status || 'draft',
              cleanValue(row.generated_at),
              cleanValue(row.published_at),
              row.created_at || new Date().toISOString(),
              row.updated_at || new Date().toISOString(),
            ],
          );
          count++;
        } catch (e: any) {
          // Skip errors
        }
      }
      console.log(`  ✅ Seeded ${count} news articles\n`);
    }

    // Summary
    console.log('📊 Final Migration Summary:');
    const counts = await Promise.all([
      client.query('SELECT COUNT(*) FROM users'),
      client.query('SELECT COUNT(*) FROM elevenlabs_languages'),
      client.query('SELECT COUNT(*) FROM categories'),
      client.query('SELECT COUNT(*) FROM elevenlabs_voices'),
      client.query('SELECT COUNT(*) FROM series'),
      client.query('SELECT COUNT(*) FROM series_characters'),
      client.query('SELECT COUNT(*) FROM series_episodes'),
      client.query('SELECT COUNT(*) FROM news_articles'),
    ]);

    console.log(`  - Users: ${counts[0].rows[0].count}`);
    console.log(`  - Languages: ${counts[1].rows[0].count}`);
    console.log(`  - Categories: ${counts[2].rows[0].count}`);
    console.log(`  - Voices: ${counts[3].rows[0].count}`);
    console.log(`  - Series: ${counts[4].rows[0].count}`);
    console.log(`  - Characters: ${counts[5].rows[0].count}`);
    console.log(`  - Episodes: ${counts[6].rows[0].count}`);
    console.log(`  - News Articles: ${counts[7].rows[0].count}`);

    console.log('\n🎉 Database seeding completed!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

seed();
