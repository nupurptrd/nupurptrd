export enum ApiKeyType {
  GEMINI = 'gemini',
  ELEVENLABS = 'elevenlabs',
  S3 = 's3',
}

export enum AppRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  EDITOR = 'editor',
  MODERATOR = 'moderator',
  VIEWER = 'viewer',
}

export enum CharacterRoleType {
  PROTAGONIST = 'protagonist',
  ANTAGONIST = 'antagonist',
  SUPPORTING = 'supporting',
  NARRATOR = 'narrator',
  RECURRING = 'recurring',
}

export enum EpisodeStatus {
  OUTLINE = 'outline',
  DRAFT = 'draft',
  REVIEW = 'review',
  APPROVED = 'approved',
  AUDIO_GENERATED = 'audio_generated',
  PUBLISHED = 'published',
}

export enum SeriesStatus {
  DRAFT = 'draft',
  IN_DEVELOPMENT = 'in_development',
  COMPLETE = 'complete',
  PUBLISHED = 'published',
}

export enum ArticleStatus {
  DRAFT = 'draft',
  REVIEW = 'review',
  APPROVED = 'approved',
  PUBLISHED = 'published',
}

export enum ArticleType {
  DETAILED = 'detailed',
  HIGHLIGHTS = 'highlights',
}
