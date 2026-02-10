import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../common/logger/logger.service';
import { Beat } from './drama-skeleton.service';

@Injectable()
export class PromptBuilderService {
  constructor(private readonly logger: LoggerService) {}

  buildEpisodePrompt(
    episodeNumber: number,
    beat: Beat,
    bookContext: {
      title: string;
      author: string;
      excerpt: string;
      mainCharacters: string[];
      genre: string;
      themes: string[];
    },
    previousEpisodeSummary?: string,
  ): string {
    const characterList = bookContext.mainCharacters.slice(0, 3).join(', ');

    return `You are an expert audio drama scriptwriter for blind and visually impaired listeners.

EPISODE GENERATION TASK
Episode #${episodeNumber}: "${beat.description}"
Narrative Beat: ${beat.type}

SOURCE MATERIAL
Book: "${bookContext.title}" by ${bookContext.author}
Genre: ${bookContext.genre}
Themes: ${bookContext.themes.join(', ')}
Main Characters: ${characterList}

CONTEXT EXCERPT
${bookContext.excerpt}

${previousEpisodeSummary ? `PREVIOUS EPISODE SUMMARY:\n${previousEpisodeSummary}\n` : ''}

STRICT REQUIREMENTS
1. Duration: 60-90 seconds (~150-225 words)
2. Structure: Hook → Narrative → Cliffhanger
3. Characters: Max 3 per episode
4. Narrator-heavy: ≥80% narration, ≤20% dialogue
5. Mandatory cliffhanger ending
6. JSON output format
7. Blind-accessible: Rich audio descriptions, clear narration

NARRATIVE DIRECTION
${beat.narrativeNote}

OUTPUT FORMAT (VALID JSON)
{
  "title": "Episode ${episodeNumber}: [Episode Title]",
  "script": "[Full episode script as a single narrative text]",
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "[Scene Title]",
      "narration": "[Narrator dialogue - 80% of content]",
      "dialogue": "[Character dialogue - 20% max]",
      "characters": ["Character 1", "Character 2"],
      "sfxNotes": "[Sound effects: ambient, transitions, mood]",
      "durationSec": 30
    }
  ],
  "cliffhangerStatement": "[The exact cliffhanger line]",
  "characterCount": 2,
  "narratorWordPercentage": 85,
  "dialogueWordPercentage": 15,
  "estimatedReadTimeSec": 75
}

Generate the episode now. Ensure valid JSON output.`;
  }

  buildDramaSkeletonPrompt(
    bookTitle: string,
    bookAuthor: string,
    bookExcerpt: string,
    targetEpisodes: number,
  ): string {
    const arcsCount = Math.ceil(targetEpisodes / 5);

    return `You are a master storyteller and narrative architect.

TASK: Generate a narrative skeleton for an audio drama series

BOOK DETAILS
Title: "${bookTitle}"
Author: ${bookAuthor}
Target Episodes: ${targetEpisodes} (organized into ${arcsCount} arcs)
Excerpt: ${bookExcerpt}

REQUIREMENTS
1. Create ${arcsCount} story arcs
2. Each arc has 5 narrative beats: Hook → Escalation → Tension → Revelation → Cliffhanger
3. Ensure series-level coherence and progression
4. Each episode should flow naturally from the source material
5. Build toward a satisfying climax in the final episode

OUTPUT FORMAT (JSON)
{
  "arcs": [
    {
      "arcNumber": 1,
      "arcTitle": "[Arc Title]",
      "beats": [
        {
          "beatNumber": 1,
          "type": "HOOK",
          "description": "[What happens in this beat]",
          "narrativeNote": "[Direction for episode writer]"
        }
      ],
      "episodeRange": { "start": 1, "end": 5 },
      "arcSummary": "[Overall arc summary]"
    }
  ],
  "seriesTheme": "[Overarching series theme]",
  "characterArc": "[How main character(s) evolve across series]"
}

Generate the skeleton now.`;
  }
}