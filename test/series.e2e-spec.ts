import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('SeriesController (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let seriesId: string;
  let characterId: string;
  let episodeId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');
    await app.init();

    // Register and login to get access token
    const testEmail = `series-test-${Date.now()}@example.com`;
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'password123',
        fullName: 'Series Test User',
      });
    accessToken = registerResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/series (POST)', () => {
    it('should create a new series', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/series')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test Audio Drama',
          logline: 'A thrilling audio adventure',
          primaryGenre: 'Drama',
          language: 'English',
          episodeCount: 10,
          episodeDurationMinutes: 15,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Test Audio Drama');
      seriesId = response.body.id;
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/series')
        .send({ title: 'Test' })
        .expect(401);
    });
  });

  describe('/api/series (GET)', () => {
    it('should get all series', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/series')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('/api/series/:id (GET)', () => {
    it('should get series by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/series/${seriesId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(seriesId);
      expect(response.body.title).toBe('Test Audio Drama');
    });

    it('should return 404 for non-existent series', async () => {
      await request(app.getHttpServer())
        .get('/api/series/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('/api/series/:id (PUT)', () => {
    it('should update series', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/series/${seriesId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Updated Audio Drama' })
        .expect(200);

      expect(response.body.title).toBe('Updated Audio Drama');
    });
  });

  describe('/api/series/:seriesId/characters (POST)', () => {
    it('should create a character', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/series/${seriesId}/characters`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Main Character',
          roleType: 'protagonist',
          age: '30',
          publicMask: 'A brave hero',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Main Character');
      characterId = response.body.id;
    });
  });

  describe('/api/series/:seriesId/characters (GET)', () => {
    it('should get all characters for a series', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/series/${seriesId}/characters`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('/api/series/:seriesId/episodes (POST)', () => {
    it('should create an episode', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/series/${seriesId}/episodes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Pilot Episode',
          episodeNumber: 1,
          synopsis: 'The adventure begins',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Pilot Episode');
      episodeId = response.body.id;
    });
  });

  describe('/api/series/:seriesId/episodes (GET)', () => {
    it('should get all episodes for a series', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/series/${seriesId}/episodes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    it('should delete episode', async () => {
      await request(app.getHttpServer())
        .delete(`/api/series/episodes/${episodeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should delete character', async () => {
      await request(app.getHttpServer())
        .delete(`/api/series/characters/${characterId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should delete series', async () => {
      await request(app.getHttpServer())
        .delete(`/api/series/${seriesId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });
});
