import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../common/logger/logger.service';

interface ContentAnalysis {
  chapters: string[];
  characterFrequency: Map<string, number>;
  summary: string;
  wordCount: number;
  estimatedPages: number;
  keyThemes: string[];
}

@Injectable()
export class ContentAnalyzerService {
  constructor(private readonly logger: LoggerService) {}

  analyze(contentText: string, title: string): ContentAnalysis {
    this.logger.log('Starting content analysis', 'ContentAnalyzer');

    const wordCount = this.countWords(contentText);
    const estimatedPages = Math.ceil(wordCount / 300);

    // Split into chapters (heuristic: assume chapter markers exist)
    const chapters = this.extractChapters(contentText);

    // Extract character names (basic heuristic)
    const characterFrequency = this.extractCharacters(contentText);

    // Generate summary (basic extraction of first paragraphs)
    const summary = this.generateSummary(contentText);

    // Extract key themes
    const keyThemes = this.extractKeyThemes(contentText, title);

    this.logger.debug('Content analysis completed', 'ContentAnalyzer', {
      wordCount,
      estimatedPages,
      chaptersCount: chapters.length,
      charactersCount: characterFrequency.size,
    });

    return {
      chapters,
      characterFrequency,
      summary,
      wordCount,
      estimatedPages,
      keyThemes,
    };
  }

  private countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  private extractChapters(text: string): string[] {
    // Simple heuristic: split by "Chapter" keyword
    const chapterRegex = /Chapter\s+\d+/gi;
    const matches = text.match(chapterRegex) || [];
    return matches.slice(0, 100); // Limit to 100 chapters
  }

  private extractCharacters(text: string): Map<string, number> {
    const frequency = new Map<string, number>();
    
    // Common character name patterns (heuristic)
    const namePatterns = [
      /\b([A-Z][a-z]+)\b/g, // Capitalized words (potential names)
    ];

    for (const pattern of namePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1];
        if (this.isLikelyCharacterName(name)) {
          frequency.set(name, (frequency.get(name) || 0) + 1);
        }
      }
    }

    // Sort by frequency and return top 50
    return new Map(
      [...frequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50),
    );
  }

  private isLikelyCharacterName(word: string): boolean {
    const commonWords = new Set([
      'The', 'A', 'An', 'And', 'Or', 'But', 'If', 'In', 'On', 'At',
      'To', 'From', 'For', 'Of', 'By', 'As', 'Is', 'Was', 'Are', 'Be',
      'This', 'That', 'These', 'Those', 'Chapter', 'Book', 'Part',
    ]);
    return !commonWords.has(word) && word.length > 2;
  }

  private generateSummary(text: string): string {
    const paragraphs = text.split('\n\n').filter((p) => p.trim().length > 0);
    const summaryParagraphs = paragraphs.slice(0, 3).join('\n\n');
    return summaryParagraphs.substring(0, 500);
  }

  private extractKeyThemes(text: string, title: string): string[] {
    const themes: string[] = [];
    const textLower = text.toLowerCase();

    // Simple keyword-based theme extraction
    const themeKeywords = {
      adventure: ['journey', 'quest', 'adventure', 'explore'],
      mystery: ['mystery', 'secret', 'hidden', 'discovery'],
      love: ['love', 'romance', 'heart', 'passion'],
      survival: ['survive', 'struggle', 'danger', 'death'],
      power: ['power', 'strength', 'control', 'authority'],
      redemption: ['redemption', 'forgive', 'change', 'transformation'],
    };

    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      const count = keywords.reduce((acc, keyword) => {
        const regex = new RegExp(keyword, 'gi');
        const matches = textLower.match(regex) || [];
        return acc + matches.length;
      }, 0);
      if (count > 5) {
        themes.push(theme);
      }
    }

    return themes.slice(0, 5);
  }
}