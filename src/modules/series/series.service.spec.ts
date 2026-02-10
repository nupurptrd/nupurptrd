import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SeriesService } from './series.service';
import { Series } from '../../entities/series.entity';
import { SeriesCharacter } from '../../entities/series-character.entity';
import { SeriesEpisode } from '../../entities/series-episode.entity';
import { Book } from '../../entities/book.entity';
import { NotFoundException } from '@nestjs/common';

describe('SeriesService', () => {
  let service: SeriesService;
  let seriesRepository: any;
  let characterRepository: any;
  let episodeRepository: any;

  const mockSeries = {
    id: 'series-1',
    title: 'Test Series',
    logline: 'A test series',
    status: 'draft',
    createdById: 'user-1',
    characters: [],
    episodes: [],
  };

  const mockCharacter = {
    id: 'char-1',
    seriesId: 'series-1',
    name: 'Test Character',
    roleType: 'protagonist',
  };

  const mockEpisode = {
    id: 'ep-1',
    seriesId: 'series-1',
    episodeNumber: 1,
    title: 'Pilot',
    status: 'draft',
    synopsis: null,
    generationPrompt: null,
    fullScript: null,
    formattedAudioScript: null,
    audioUrl: null,
    durationSeconds: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockSeriesRepo = {
      createQueryBuilder: jest.fn(() => ({
        orderBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getManyAndCount: jest.fn().mockResolvedValue([[mockSeries], 1]),
        getMany: jest.fn().mockResolvedValue([mockSeries]),
      })),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const mockCharacterRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const mockEpisodeRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const mockBookRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeriesService,
        { provide: getRepositoryToken(Series), useValue: mockSeriesRepo },
        {
          provide: getRepositoryToken(SeriesCharacter),
          useValue: mockCharacterRepo,
        },
        {
          provide: getRepositoryToken(SeriesEpisode),
          useValue: mockEpisodeRepo,
        },
        { provide: getRepositoryToken(Book), useValue: mockBookRepo },
      ],
    }).compile();

    service = module.get<SeriesService>(SeriesService);
    seriesRepository = module.get(getRepositoryToken(Series));
    characterRepository = module.get(getRepositoryToken(SeriesCharacter));
    episodeRepository = module.get(getRepositoryToken(SeriesEpisode));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllSeries', () => {
    it('should return paginated series', async () => {
      const result = await service.findAllSeries();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('findOneSeries', () => {
    it('should return a series by id', async () => {
      seriesRepository.findOne.mockResolvedValue(mockSeries);
      const result = await service.findOneSeries('series-1');
      expect(result.id).toBe('series-1');
      expect(result.title).toBe('Test Series');
    });

    it('should throw NotFoundException when series not found', async () => {
      seriesRepository.findOne.mockResolvedValue(null);
      await expect(service.findOneSeries('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createSeries', () => {
    it('should create a new series', async () => {
      seriesRepository.create.mockReturnValue(mockSeries);
      seriesRepository.save.mockResolvedValue(mockSeries);

      const result = await service.createSeries(
        { title: 'Test Series', logline: 'A test series' },
        'user-1',
      );

      expect(result.id).toBe(mockSeries.id);
      expect(result.title).toBe(mockSeries.title);
    });
  });

  describe('updateSeries', () => {
    it('should update a series', async () => {
      seriesRepository.findOne.mockResolvedValue(mockSeries);
      seriesRepository.save.mockResolvedValue({
        ...mockSeries,
        title: 'Updated Title',
      });

      const result = await service.updateSeries('series-1', {
        title: 'Updated Title',
      });
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('deleteSeries', () => {
    it('should delete a series', async () => {
      seriesRepository.findOne.mockResolvedValue(mockSeries);
      seriesRepository.remove.mockResolvedValue(mockSeries);

      const result = await service.deleteSeries('series-1');
      expect(result.success).toBe(true);
    });
  });

  describe('Characters', () => {
    it('should find characters for a series', async () => {
      characterRepository.find.mockResolvedValue([mockCharacter]);
      const result = await service.findCharacters('series-1');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    });

    it('should create a character', async () => {
      characterRepository.create.mockReturnValue(mockCharacter);
      characterRepository.save.mockResolvedValue(mockCharacter);

      const result = await service.createCharacter({
        name: 'Test Character',
        seriesId: 'series-1',
      });

      expect(result.id).toBe(mockCharacter.id);
      expect(result.name).toBe(mockCharacter.name);
    });

    it('should update a character', async () => {
      characterRepository.findOne.mockResolvedValue(mockCharacter);
      characterRepository.save.mockResolvedValue({
        ...mockCharacter,
        name: 'Updated Name',
      });

      const result = await service.updateCharacter('char-1', {
        name: 'Updated Name',
      });
      expect(result.name).toBe('Updated Name');
    });

    it('should delete a character', async () => {
      characterRepository.findOne.mockResolvedValue(mockCharacter);
      characterRepository.remove.mockResolvedValue(mockCharacter);

      const result = await service.deleteCharacter('char-1');
      expect(result.success).toBe(true);
    });
  });

  describe('Episodes', () => {
    it('should find episodes for a series', async () => {
      episodeRepository.find.mockResolvedValue([mockEpisode]);
      const result = await service.findEpisodes('series-1');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    });

    it('should create an episode', async () => {
      episodeRepository.create.mockReturnValue(mockEpisode);
      episodeRepository.save.mockResolvedValue(mockEpisode);

      const result = await service.createEpisode({
        title: 'Pilot',
        episodeNumber: 1,
        seriesId: 'series-1',
      });

      expect(result.id).toBe(mockEpisode.id);
      expect(result.title).toBe(mockEpisode.title);
    });

    it('should update an episode', async () => {
      episodeRepository.findOne.mockResolvedValue(mockEpisode);
      episodeRepository.save.mockResolvedValue({
        ...mockEpisode,
        title: 'Updated Title',
      });

      const result = await service.updateEpisode('ep-1', {
        title: 'Updated Title',
      });
      expect(result.title).toBe('Updated Title');
    });

    it('should delete an episode', async () => {
      episodeRepository.findOne.mockResolvedValue(mockEpisode);
      episodeRepository.remove.mockResolvedValue(mockEpisode);

      const result = await service.deleteEpisode('ep-1');
      expect(result.success).toBe(true);
    });
  });
});
