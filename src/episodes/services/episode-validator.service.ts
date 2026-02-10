import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../common/logger/logger.service';
import { Episode } from '@prisma/client';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    durationSec: number;
    wordCount: number;
    characterCount: number;
    dialogueRatio: number;
    hasCliffhanger: boolean;
    narratorRatio: number;
  };
}

@Injectable()
export class EpisodeValidatorService {
  constructor(private readonly logger: LoggerService) {}

  validate(episode: Partial<Episode> & { scriptText: string }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const metrics = this.extractMetrics(episode.scriptText, episode);

    // Rule 1: Duration check (60-90 seconds)
    if (metrics.durationSec < 60) {
      errors.push(`Duration too short: ${metrics.durationSec}s < 60s`);
    } else if (metrics.durationSec > 90) {
      errors.push(`Duration too long: ${metrics.durationSec}s > 90s`);
    }

    // Rule 2: Character count (<=3)
    if (metrics.characterCount > 3) {
      errors.push(
        `Too many characters: ${metrics.characterCount} > 3 (violates <=3 limit)`,
      );
    } else if (metrics.characterCount > 2) {
      warnings.push(`Warning: ${metrics.characterCount} characters (max recommended: 2)`);
    }

    // Rule 3: Dialogue ratio (<=40%)
    if (metrics.dialogueRatio > 40) {
      errors.push(
        `Dialogue ratio too high: ${metrics.dialogueRatio.toFixed(1)}% > 40%`,
      );
    } else if (metrics.dialogueRatio > 30) {
      warnings.push(
        `Warning: Dialogue ratio ${metrics.dialogueRatio.toFixed(1)}% (recommend <=30%)`,
      );
    }

    // Rule 4: Cliffhanger detection
    if (!metrics.hasCliffhanger) {
      errors.push('Mandatory cliffhanger missing at episode end');
    }

    // Rule 5: Narrator ratio (>=80%)
    if (metrics.narratorRatio < 60) {
      warnings.push(
        `Narration too low: ${metrics.narratorRatio.toFixed(1)}% (recommend >=80%)`,
      );
    }

    // Additional validation
    if (metrics.wordCount < 150) {
      errors.push(`Content too short: ${metrics.wordCount} words < 150`);
    } else if (metrics.wordCount > 225) {
      warnings.push(`Content slightly long: ${metrics.wordCount} words > 225`);
    }

    const isValid = errors.length === 0;

    this.logger.debug('Episode validation completed', 'EpisodeValidatorService', {
      isValid,
      errorCount: errors.length,
      warningCount: warnings.length,
      metrics,
    });

    return {
      isValid,
      errors,
      warnings,
      metrics,
    };
  }

  private extractMetrics(
    scriptText: string,
    episode: Partial<Episode> & { scriptText: string },
  ): ValidationResult['metrics'] {
    const wordCount = this.countWords(scriptText);
    const durationSec = Math.round(wordCount * 0.5); // Rough estimate: 2 words per second
    const characterCount =
      episode.characterCount ?? this.estimateCharacterCount(scriptText);
    const dialogueRatio =
      episode.dialogueRatioPct ?? this.estimateDialogueRatio(scriptText);
    const narratorRatio =
      episode.narratorRatioPct ?? Math.max(0, 100 - dialogueRatio);
    const hasCliffhanger = this.detectCliffhanger(scriptText);

    return {
      durationSec,
      wordCount,
      characterCount,
      dialogueRatio,
      hasCliffhanger,
      narratorRatio,
    };
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
  }

  private estimateDialogueRatio(text: string): number {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      return 0;
    }
    const dialogueLines = lines.filter((line) => {
      const trimmed = line.trim();
      return (
        /^([A-Z][A-Za-z0-9_-]{1,20}):/.test(trimmed) ||
        /\"[^\"]+\"/.test(trimmed)
      );
    }).length;
    return Math.min(100, Math.round((dialogueLines / lines.length) * 100));
  }

  private detectCliffhanger(text: string): boolean {
    const ending = text.trim().slice(-300).toLowerCase();
    return /to be continued|cliffhanger|suddenly|but then|before (he|she|they) could|everything changed|at that moment/.test(
      ending,
    );
  }

  private estimateCharacterCount(text: string): number {
    const matches = text.match(/\b[A-Z][a-z]{2,}\b/g) || [];
    const unique = new Set(matches);
    return Math.min(5, Math.max(1, unique.size));
  }
}
