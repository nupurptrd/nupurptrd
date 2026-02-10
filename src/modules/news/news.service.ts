import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NewsArticle } from '../../entities/news-article.entity';

// Transform news article to snake_case for frontend compatibility
function transformArticle(article: NewsArticle): any {
  if (!article) return null;
  return {
    id: article.id,
    category_id: article.categoryId,
    title: article.title,
    content: article.content,
    summary: article.summary,
    language: article.language,
    article_type: article.articleType,
    locality_focus: article.localityFocus,
    tags: article.tags || [],
    emotion_tags: article.emotionTags || [],
    suggested_emotion: article.suggestedEmotion,
    formatted_script: article.formattedScript,
    voice_id: article.voiceId,
    voice_name: article.voiceName,
    voice_settings: article.voiceSettings,
    audio_url: article.audioUrl,
    s3_key: article.s3Key,
    status: article.status,
    generated_at: article.generatedAt,
    published_at: article.publishedAt,
    created_at: article.createdAt,
    updated_at: article.updatedAt,
    category: article.category
      ? {
          id: article.category.id,
          name: article.category.name,
          icon: article.category.icon,
        }
      : null,
  };
}

@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(NewsArticle)
    private newsRepository: Repository<NewsArticle>,
  ) {}

  async findAll(filters?: {
    search?: string;
    categoryId?: string;
    language?: string;
    status?: string;
    articleType?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      search,
      categoryId,
      language,
      status,
      articleType,
      page = 1,
      limit = 20,
    } = filters || {};

    const query = this.newsRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.category', 'category')
      .orderBy('article.createdAt', 'DESC');

    if (search) {
      query.andWhere(
        '(article.title ILIKE :search OR article.content ILIKE :search OR article.summary ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (categoryId) {
      query.andWhere('article.categoryId = :categoryId', { categoryId });
    }

    if (language) {
      query.andWhere('article.language = :language', { language });
    }

    if (status) {
      query.andWhere('article.status = :status', { status });
    } else {
      // Default to published for public access
      query.andWhere('article.status = :status', { status: 'published' });
    }

    if (articleType) {
      query.andWhere('article.articleType = :articleType', { articleType });
    }

    // Get total count for pagination
    const total = await query.getCount();

    // Apply pagination
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const articles = await query.getMany();

    return {
      data: articles.map(transformArticle),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + articles.length < total,
      },
    };
  }

  /**
   * Find published articles with audio only (for public/mobile app)
   */
  async findPublishedWithAudio(filters?: {
    search?: string;
    categoryId?: string;
    language?: string;
    articleType?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      search,
      categoryId,
      language,
      articleType,
      page = 1,
      limit = 20,
    } = filters || {};

    const query = this.newsRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.category', 'category')
      .where('article.status = :status', { status: 'published' })
      .andWhere('article.audioUrl IS NOT NULL')
      .andWhere("article.audioUrl != ''")
      .orderBy('article.createdAt', 'DESC');

    if (search) {
      query.andWhere(
        '(article.title ILIKE :search OR article.content ILIKE :search OR article.summary ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (categoryId) {
      query.andWhere('article.categoryId = :categoryId', { categoryId });
    }

    if (language) {
      query.andWhere('article.language = :language', { language });
    }

    if (articleType) {
      query.andWhere('article.articleType = :articleType', { articleType });
    }

    // Get total count for pagination
    const total = await query.getCount();

    // Apply pagination
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const articles = await query.getMany();

    return {
      data: articles.map(transformArticle),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + articles.length < total,
      },
    };
  }

  async findOne(id: string) {
    const article = await this.newsRepository.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    return article;
  }

  async findOneTransformed(id: string) {
    const article = await this.findOne(id);
    return transformArticle(article);
  }

  async create(data: any) {
    // Transform snake_case input to camelCase for entity
    const article = this.newsRepository.create({
      categoryId: data.category_id,
      title: data.title,
      content: data.content,
      summary: data.summary,
      language: data.language,
      articleType: data.article_type,
      localityFocus: data.locality_focus,
      tags: data.tags || [],
      emotionTags: data.emotion_tags || [],
      suggestedEmotion: data.suggested_emotion,
      formattedScript: data.formatted_script,
      voiceId: data.voice_id,
      voiceName: data.voice_name,
      voiceSettings: data.voice_settings,
      audioUrl: data.audio_url,
      s3Key: data.s3_key,
      status: data.status || 'draft',
      generatedAt: data.generated_at || new Date(),
    });
    const saved = await this.newsRepository.save(article);
    return transformArticle(saved);
  }

  async update(id: string, data: any) {
    const article = await this.findOne(id);
    // Transform snake_case input to camelCase for entity
    if (data.category_id !== undefined) article.categoryId = data.category_id;
    if (data.title !== undefined) article.title = data.title;
    if (data.content !== undefined) article.content = data.content;
    if (data.summary !== undefined) article.summary = data.summary;
    if (data.language !== undefined) article.language = data.language;
    if (data.article_type !== undefined)
      article.articleType = data.article_type;
    if (data.locality_focus !== undefined)
      article.localityFocus = data.locality_focus;
    if (data.tags !== undefined) article.tags = data.tags;
    if (data.emotion_tags !== undefined)
      article.emotionTags = data.emotion_tags;
    if (data.suggested_emotion !== undefined)
      article.suggestedEmotion = data.suggested_emotion;
    if (data.formatted_script !== undefined)
      article.formattedScript = data.formatted_script;
    if (data.voice_id !== undefined) article.voiceId = data.voice_id;
    if (data.voice_name !== undefined) article.voiceName = data.voice_name;
    if (data.voice_settings !== undefined)
      article.voiceSettings = data.voice_settings;
    if (data.audio_url !== undefined) article.audioUrl = data.audio_url;
    if (data.s3_key !== undefined) article.s3Key = data.s3_key;
    if (data.status !== undefined) article.status = data.status;
    const saved = await this.newsRepository.save(article);
    return transformArticle(saved);
  }

  async delete(id: string) {
    const article = await this.findOne(id);
    await this.newsRepository.remove(article);
    return { success: true };
  }

  async updateStatus(id: string, status: string) {
    const article = await this.findOne(id);
    article.status = status;
    if (status === 'published') {
      article.publishedAt = new Date();
    }
    const saved = await this.newsRepository.save(article);
    return transformArticle(saved);
  }

  async updateAudioUrl(
    id: string,
    audioUrl: string,
    voiceId?: string,
    voiceName?: string,
  ) {
    const article = await this.findOne(id);
    article.audioUrl = audioUrl;
    if (voiceId) article.voiceId = voiceId;
    if (voiceName) article.voiceName = voiceName;
    const saved = await this.newsRepository.save(article);
    return transformArticle(saved);
  }

  /**
   * Get news feed - combines categories and featured articles with paginated list
   * Optimized for mobile app home/news screen
   */
  async getNewsFeed(options?: {
    categoryId?: string;
    language?: string;
    page?: number;
    limit?: number;
  }) {
    const { categoryId, language, page = 1, limit = 20 } = options || {};

    // Get featured articles (latest 5 published with audio)
    const featuredQuery = this.newsRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.category', 'category')
      .where('article.status = :status', { status: 'published' })
      .andWhere('article.audioUrl IS NOT NULL')
      .andWhere("article.audioUrl != ''")
      .orderBy('article.publishedAt', 'DESC')
      .take(5);

    const featured = await featuredQuery.getMany();

    // Get paginated articles
    const articlesResult = await this.findAll({
      status: 'published',
      categoryId,
      language,
      page,
      limit,
    });

    // Get unique categories from all articles
    const categoriesQuery = this.newsRepository
      .createQueryBuilder('article')
      .leftJoin('article.category', 'category')
      .select('category.id', 'id')
      .addSelect('category.name', 'name')
      .addSelect('category.icon', 'icon')
      .where('article.status = :status', { status: 'published' })
      .andWhere('category.id IS NOT NULL')
      .groupBy('category.id')
      .addGroupBy('category.name')
      .addGroupBy('category.icon');

    const categories = await categoriesQuery.getRawMany();

    return {
      featured: featured.map(transformArticle),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
      })),
      articles: articlesResult.data,
      pagination: articlesResult.pagination,
      fetched_at: new Date().toISOString(),
    };
  }
}
