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

async function seedNews() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: process.env.DATABASE_USER || 'deepparmar',
    password: process.env.DATABASE_PASSWORD || '',
    database: 'smarton_content',
  });

  await client.connect();
  console.log('📰 Seeding News Articles...\n');

  try {
    const newsFile = fs
      .readdirSync(backupPath)
      .find((f) => f.includes('news_articles'));
    if (!newsFile) {
      console.log('No news articles file found');
      return;
    }

    const content = fs.readFileSync(path.join(backupPath, newsFile), 'utf-8');

    // Use csv-parse to handle complex CSV with multi-line content
    const records = parse(content, {
      columns: true,
      delimiter: ';',
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: true,
    });

    console.log(`Found ${records.length} news articles to seed\n`);

    let count = 0;
    let errors = 0;

    for (const row of records as Record<string, string>[]) {
      // Skip if no valid id
      if (!row.id || row.id.length !== 36) {
        continue;
      }

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
        if (count % 10 === 0) {
          process.stdout.write(`  Seeded ${count} articles...\r`);
        }
      } catch (e: any) {
        errors++;
        if (errors <= 5) {
          console.error(`  Error: ${e.message.substring(0, 100)}`);
        }
      }
    }

    console.log(`\n✅ Seeded ${count} news articles (${errors} errors)\n`);

    // Get final count
    const result = await client.query('SELECT COUNT(*) FROM news_articles');
    console.log(`📊 Total news articles in database: ${result.rows[0].count}`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

seedNews();
