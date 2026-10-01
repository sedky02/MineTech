import { randomUUID } from 'node:crypto';
import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  PARTICIPANT_COOKIE,
  PARTICIPANT_COOKIE_TTL_MS,
  SUBMISSION_IP_LIMIT,
} from '../common/constants.js';
import { baseCookieOptions } from '../common/utils/cookies.js';
import { CreateQuestionDto } from './dto/create-question.dto.js';
import { QuestionsService } from './questions.service.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public participant endpoint. Participants have no account, only a session cookie. */
@Controller('questions')
export class QuestionsController {
  private readonly isProduction: boolean;

  constructor(
    private readonly questions: QuestionsService,
    config: ConfigService,
  ) {
    this.isProduction = config.get('NODE_ENV') === 'production';
  }

  @Post()
  @HttpCode(201)
  @Throttle({ default: SUBMISSION_IP_LIMIT })
  async create(
    @Body() dto: CreateQuestionDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ received: true }> {
    const sessionId = this.resolveParticipantSession(req, res);
    // Throws on any failure (including the DB write), so success is only
    // reported once the question is stored.
    await this.questions.create(dto, sessionId);
    return { received: true };
  }

  private resolveParticipantSession(req: Request, res: Response): string {
    const existing = (req.cookies as Record<string, string> | undefined)?.[
      PARTICIPANT_COOKIE
    ];
    if (existing && UUID_PATTERN.test(existing)) return existing;

    const sessionId = randomUUID();
    res.cookie(PARTICIPANT_COOKIE, sessionId, {
      ...baseCookieOptions(this.isProduction),
      maxAge: PARTICIPANT_COOKIE_TTL_MS,
    });
    return sessionId;
  }
}
