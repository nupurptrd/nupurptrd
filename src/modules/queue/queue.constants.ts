/**
 * Queue name constants used across the queue module
 */
export const QUEUE_NAMES = {
  NEWS_GENERATION: 'news-generation',
  AUDIO_GENERATION: 'audio-generation',
  BOOK_PROCESSING: 'book-processing',
  SERIES_GENERATION: 'series-generation',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
