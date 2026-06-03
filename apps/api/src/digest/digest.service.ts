import { randomUUID } from 'crypto';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DigestFrequency } from '@prisma/client';
import type { ActionCandidate } from '@ai/shared-types';
import type { TruthLensPayload } from '@ai/ai-core';

import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { SearchService } from '../search/search.service';
import { FeatureAccessService } from '../subscriptions/feature-access.service';
import { Features } from '../subscriptions/plan-entitlements';
import type { SearchResult } from '../search/search.types';

import { SubscribeDigestDto } from './dto/subscribe-digest.dto';
import { UnsubscribeDigestDto } from './dto/unsubscribe-digest.dto';

export interface DigestGenerationResult {
  topic: string;
  searchQuery: string;
  title: string;
  highlights: string[];
  content: string;
  actionCandidates: ActionCandidate[];
  mode: 'digest' | 'truthlens';
  truthLens?: TruthLensPayload;
}

/**
 * Heuristics that strongly suggest a TruthLens (comparative) response is more useful
 * than a neutral information digest.
 */
const TRUTHLENS_PATTERNS: RegExp[] = [
  /\b(vs\.?|versus)\b/i,
  /\bcompare(d)?\b/i,
  /\b(which|what)\s+is\s+better\b/i,
  /\bshould\s+i\b/i,
  /\bpros\s+and\s+cons\b/i,
  /\bdownsides?\s+of\b/i,
  /\bbenefits?\s+of\b.*\bvs\b/i,
  /\b(opinions?|debate|controversy)\b/i,
  /\bwhy\s+(is|do)\b.*\b(controversial|disputed)\b/i,
];

const TRUTHLENS_ENABLED_DEFAULT = true;

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);
  private readonly truthLensEnabled =
    (process.env.TRUTHLENS_V2_ENABLED ?? '').toLowerCase() !== 'false' && TRUTHLENS_ENABLED_DEFAULT;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly searchService: SearchService,
    private readonly featureAccess: FeatureAccessService,
  ) {}

  // TODO(info-digest): integrate cron worker to deliver scheduled digests from subscriptions.

  async generateDigest(userId: string, userMessage: string): Promise<DigestGenerationResult> {
    const queryResult = await this.ai.generateInfoSearchQuery(userMessage);
    const searchQuery = this.resolveSearchQuery(queryResult.searchQuery, userMessage);
    const topic = this.resolveTopic(queryResult.topic, userMessage, searchQuery);

    const searchResults = await this.searchService.search(searchQuery);

    const truthLensAllowed =
      this.truthLensEnabled && (await this.featureAccess.canUse(userId, Features.TRUTHLENS));
    const truthLensRoute = truthLensAllowed ? await this.maybeRouteTruthLens(userMessage) : false;

    if (truthLensRoute) {
      const truthLens = await this.ai
        .generateTruthLensDigest(userMessage, searchResults)
        .catch(error => {
          this.logger.warn(
            `TruthLens generation failed; falling back to plain digest: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          return null;
        });

      if (truthLens) {
        const actionCandidates = await this.buildSubscriptionSuggestion(userId, topic);
        return {
          topic,
          searchQuery,
          title: truthLens.title,
          highlights: truthLens.perspectives.map(perspective => perspective.claim),
          content: this.renderTruthLens(truthLens),
          actionCandidates,
          mode: 'truthlens',
          truthLens,
        };
      }
    }

    const summary = await this.ai.generateInfoDigestSummary(searchResults);
    const title = this.resolveTitle(summary.title, topic);
    const highlights = this.resolveHighlights(summary.highlights, searchResults);
    const actionCandidates = await this.buildSubscriptionSuggestion(userId, topic);

    return {
      topic,
      searchQuery,
      title,
      highlights,
      content: this.renderDigest(title, highlights),
      actionCandidates,
      mode: 'digest',
    };
  }

  /**
   * Returns true when the user's message looks like a comparative / value-judgment query.
   * Falls back to the LLM classifier only when the heuristic is uncertain.
   */
  private async maybeRouteTruthLens(userMessage: string): Promise<boolean> {
    if (!userMessage || userMessage.trim().length < 4) {
      return false;
    }
    if (TRUTHLENS_PATTERNS.some(pattern => pattern.test(userMessage))) {
      return true;
    }
    try {
      const classification = await this.ai.classifyInfoQuery(userMessage);
      return classification.mode === 'truthlens';
    } catch (error) {
      this.logger.warn(
        `TruthLens classification failed; defaulting to digest: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  private renderTruthLens(payload: TruthLensPayload): string {
    const lines: string[] = [
      `### ${payload.title}`,
      '',
      `**Question:** ${payload.question}`,
      '',
      `**Confidence:** ${payload.confidence}`,
      '',
    ];

    payload.perspectives.forEach(perspective => {
      lines.push(`#### ${perspective.label}`);
      lines.push(perspective.claim);
      lines.push('');
      if (perspective.evidence.length > 0) {
        lines.push('Evidence:');
        perspective.evidence.forEach(item => lines.push(`- ${item}`));
        lines.push('');
      }
      if (perspective.limitations.length > 0) {
        lines.push('Limitations:');
        perspective.limitations.forEach(item => lines.push(`- ${item}`));
        lines.push('');
      }
    });

    if (payload.consensus) {
      lines.push('**Shared ground:**');
      lines.push(payload.consensus);
      lines.push('');
    }

    if (payload.openQuestions.length > 0) {
      lines.push('**Open questions:**');
      payload.openQuestions.forEach(question => lines.push(`- ${question}`));
      lines.push('');
    }

    return lines.join('\n').trimEnd();
  }

  async subscribe(userId: string, dto: SubscribeDigestDto) {
    const topicInput = dto.topic.trim();
    const normalizedName = this.normalizeTopic(topicInput);
    if (!normalizedName) {
      throw new BadRequestException('Topic is required');
    }
    const frequency = this.mapFrequency(dto.frequency);

    const { maxDigestTopics } = await this.featureAccess.getPlanLimits(userId);

    const alreadySubscribed = await this.prisma.digestSubscription.findFirst({
      where: {
        userId,
        topic: {
          normalizedName,
        },
      },
      select: {
        id: true,
      },
    });

    if (!alreadySubscribed) {
      const subscriptionsCount = await this.prisma.digestSubscription.count({
        where: {
          userId,
        },
      });

      if (subscriptionsCount >= maxDigestTopics) {
        throw new BadRequestException(`Your plan supports up to ${maxDigestTopics} digest topics.`);
      }
    }

    const topic = await this.prisma.digestTopic.upsert({
      where: { normalizedName },
      create: {
        name: topicInput,
        normalizedName,
      },
      update: {
        // Keep latest display name formatting from user input.
        name: topicInput,
      },
    });

    const subscription = await this.prisma.digestSubscription.upsert({
      where: {
        userId_topicId: {
          userId,
          topicId: topic.id,
        },
      },
      create: {
        userId,
        topicId: topic.id,
        frequency,
      },
      update: {
        frequency,
      },
      include: {
        topic: true,
      },
    });

    return {
      id: subscription.id,
      topic: subscription.topic.name,
      frequency: subscription.frequency.toLowerCase(),
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
    };
  }

  async unsubscribe(userId: string, dto: UnsubscribeDigestDto) {
    const normalizedName = this.normalizeTopic(dto.topic);
    const topic = await this.prisma.digestTopic.findUnique({
      where: {
        normalizedName,
      },
    });

    if (!topic) {
      return {
        success: true,
        deleted: false,
      };
    }

    const result = await this.prisma.digestSubscription.deleteMany({
      where: {
        userId,
        topicId: topic.id,
      },
    });

    return {
      success: true,
      deleted: result.count > 0,
    };
  }

  async listSubscriptions(userId: string) {
    const subscriptions = await this.prisma.digestSubscription.findMany({
      where: {
        userId,
      },
      include: {
        topic: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return subscriptions.map(subscription => ({
      id: subscription.id,
      topic: subscription.topic.name,
      frequency: subscription.frequency.toLowerCase(),
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
    }));
  }

  async subscribeFromSuggestion(
    userId: string,
    payload: Record<string, unknown>,
  ): Promise<{ topic: string; frequency: string }> {
    const topic = typeof payload.topic === 'string' ? payload.topic.trim() : '';
    const frequency = typeof payload.frequency === 'string' ? payload.frequency : 'daily';
    if (!topic) {
      throw new BadRequestException('Digest subscription suggestion has no topic');
    }

    const subscription = await this.subscribe(userId, {
      topic,
      frequency: frequency === 'daily' ? 'daily' : 'daily',
    });

    return {
      topic: subscription.topic,
      frequency: subscription.frequency,
    };
  }

  private async buildSubscriptionSuggestion(
    userId: string,
    topic: string,
  ): Promise<ActionCandidate[]> {
    const isSubscribed = await this.isSubscribed(userId, topic);
    if (isSubscribed) {
      return [];
    }

    return [
      {
        id: randomUUID(),
        type: 'SUGGEST_DIGEST_SUBSCRIPTION',
        payload: {
          topic,
          frequency: 'daily',
        },
        confidence: 0.8,
        requiresConfirmation: true,
      },
    ];
  }

  private async isSubscribed(userId: string, topic: string): Promise<boolean> {
    const normalizedName = this.normalizeTopic(topic);
    const subscription = await this.prisma.digestSubscription.findFirst({
      where: {
        userId,
        topic: {
          normalizedName,
        },
      },
      select: {
        id: true,
      },
    });

    return Boolean(subscription);
  }

  private normalizeTopic(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private mapFrequency(value?: 'daily'): DigestFrequency {
    return value === 'daily' ? DigestFrequency.DAILY : DigestFrequency.DAILY;
  }

  private resolveSearchQuery(raw: string, fallbackMessage: string): string {
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    if (trimmed.length >= 3) {
      return trimmed;
    }
    return fallbackMessage.trim().slice(0, 180);
  }

  private resolveTopic(rawTopic: string | undefined, message: string, query: string): string {
    const candidate = typeof rawTopic === 'string' ? rawTopic.trim() : '';
    if (candidate.length >= 2) {
      return candidate;
    }

    const match =
      message.match(/updates?\s+on\s+(.+)/i) ??
      message.match(/news\s+about\s+(.+)/i) ??
      message.match(/about\s+(.+)/i);
    if (match && match[1]) {
      return this.toDisplayTopic(match[1]);
    }

    return this.toDisplayTopic(query);
  }

  private resolveTitle(raw: string, topic: string): string {
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    return trimmed.length > 6 ? trimmed : `${topic} - latest digest`;
  }

  private resolveHighlights(raw: string[], searchResults: SearchResult[]): string[] {
    const filtered = Array.isArray(raw)
      ? raw.map(item => item.trim()).filter(item => item.length > 0)
      : [];

    const normalized = filtered
      .slice(0, 5)
      .map(item => (/[.!?]$/.test(item) ? item : `${item}.`))
      .filter(item => item.split(/\s+/).length >= 4);

    if (normalized.length >= 3) {
      return normalized.slice(0, 5);
    }

    if (searchResults.length === 0) {
      return ['No recent results were found for this topic in the current search provider.'];
    }

    return searchResults.slice(0, 3).map(result => {
      const snippet = result.snippet.trim() || result.title.trim();
      return /[.!?]$/.test(snippet) ? snippet : `${snippet}.`;
    });
  }

  private toDisplayTopic(value: string): string {
    const compact = value.replace(/\s+/g, ' ').trim();
    if (!compact) {
      return 'General';
    }
    return compact.charAt(0).toUpperCase() + compact.slice(1);
  }

  private renderDigest(title: string, highlights: string[]): string {
    const lines = highlights.map(item => `- ${item}`);
    return [`### ${title}`, '', ...lines].join('\n');
  }
}
