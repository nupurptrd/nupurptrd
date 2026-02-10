import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../common/logger/logger.service';
import { BeatType } from '@prisma/client';

export interface DramaSkeletonResult {
  arcs: DramaArc[];
  totalEpisodes: number;
  estimatedDuration: string;
}

export interface DramaArc {
  arcNumber: number;
  beats: Beat[];
  episodeRange: { start: number; end: number };
}

export interface Beat {
  type: BeatType;
  description: string;
  narrativeNote: string;
}

@Injectable()
export class DramaSkeletonService {
  constructor(private readonly logger: LoggerService) {}

  generateSkeleton(
    bookContent: string,
    targetEpisodeCount: number,
    bookTitle: string,
    bookAuthor: string,
  ): DramaSkeletonResult {
    this.logger.log(
      `Generating drama skeleton for ${targetEpisodeCount} episodes`,
      'DramaSkeletonService',
    );

    // Calculate arcs: 3-5 episodes per arc
    const arcsCount = Math.ceil(targetEpisodeCount / 5);
    const arcs: DramaArc[] = [];

    for (let arcNum = 1; arcNum <= arcsCount; arcNum++) {
      const episodeStart = (arcNum - 1) * 5 + 1;
      const episodeEnd = Math.min(arcNum * 5, targetEpisodeCount);

      const arc = this.generateArc(
        arcNum,
        episodeStart,
        episodeEnd,
        bookContent,
        bookTitle,
        bookAuthor,
      );

      arcs.push(arc);
    }

    const estimatedDuration = `${Math.round((targetEpisodeCount * 75) / 60)} minutes`;

    this.logger.debug('Drama skeleton generated', 'DramaSkeletonService', {
      arcsCount,
      totalEpisodes: targetEpisodeCount,
      estimatedDuration,
    });

    return { arcs, totalEpisodes: targetEpisodeCount, estimatedDuration };
  }

  private generateArc(
    arcNumber: number,
    episodeStart: number,
    episodeEnd: number,
    bookContent: string,
    bookTitle: string,
    bookAuthor: string,
  ): DramaArc {
    // Extract a relevant excerpt from book content for narrative inspiration
    const excerpt = this.extractExcerpt(bookContent, arcNumber);

    const beats: Beat[] = [
      {
        type: 'HOOK' as BeatType,
        description: `Episode ${episodeStart}: Introduce primary conflict and characters`,
        narrativeNote: `Begin with a compelling hook related to: "${excerpt.substring(0, 80)}..."`,
      },
      {
        type: 'ESCALATION' as BeatType,
        description: `Episode ${episodeStart + 1}: Complications arise`,
        narrativeNote: 'Raise the stakes and introduce obstacles',
      },
      {
        type: 'TENSION' as BeatType,
        description: `Episode ${episodeStart + 2}: Climax building`,
        narrativeNote: 'Maximum pressure on protagonist(s)',
      },
      {
        type: 'REVELATION' as BeatType,
        description: `Episode ${episodeStart + 3}: Truth revealed`,
        narrativeNote: 'Major twist or key information revealed',
      },
      {
        type: 'CLIFFHANGER' as BeatType,
        description: `Episode ${episodeEnd}: Arc conclusion with cliffhanger`,
        narrativeNote: 'Resolve arc but leave major question unanswered for next arc',
      },
    ];

    return {
      arcNumber,
      beats: beats.slice(0, episodeEnd - episodeStart + 1),
      episodeRange: { start: episodeStart, end: episodeEnd },
    };
  }

  private extractExcerpt(content: string, arcNumber: number): string {
    const sections = content.split(/\n\n+/);
    const sectionIndex = Math.min(arcNumber * 5 - 1, sections.length - 1);
    return sections[sectionIndex]?.substring(0, 200) || content.substring(0, 200);
  }
}