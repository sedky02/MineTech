import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { Room, SocketEvent } from '../realtime/realtime.events.js';

export interface ModeratorCategory {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  displayOrder: number;
  questionCount: number;
}

/** "AI & Data" → "ai-data"; accents dropped, anything else becomes a dash. */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return slug || 'topic';
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** What students pick from. */
  findActive() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: { name: true, slug: true },
    });
  }

  /** Every topic, hidden ones included, with how many questions use it. */
  async findAllForModerator(): Promise<ModeratorCategory[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: { displayOrder: 'asc' },
      include: { _count: { select: { questions: true } } },
    });
    return rows.map(({ _count, createdAt: _createdAt, ...category }) => ({
      ...category,
      questionCount: _count.questions,
    }));
  }

  async create(name: string): Promise<ModeratorCategory> {
    await this.assertNameFree(name);
    const [last, slug] = await Promise.all([
      this.prisma.category.findFirst({
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      }),
      this.freeSlug(slugify(name)),
    ]);
    const created = await this.prisma.category.create({
      data: { name, slug, displayOrder: (last?.displayOrder ?? 0) + 1 },
    });
    this.changed();
    return this.view(created.id);
  }

  /**
   * Renames and/or hides a topic. The slug never changes: questions, colours
   * and filters refer to it.
   */
  async update(
    id: string,
    changes: { name?: string; isActive?: boolean },
  ): Promise<ModeratorCategory> {
    if (changes.name === undefined && changes.isActive === undefined) {
      throw new BadRequestException('Nothing to change');
    }
    const current = await this.prisma.category.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Topic not found');
    if (changes.name !== undefined && changes.name !== current.name) {
      await this.assertNameFree(changes.name, id);
    }
    if (changes.isActive === false && current.isActive) {
      await this.assertAnotherActive(id);
    }

    await this.prisma.category.update({
      where: { id },
      data: { name: changes.name, isActive: changes.isActive },
    });
    this.changed();
    return this.view(id);
  }

  /** Only unused topics can be deleted; used ones are hidden instead. */
  async remove(id: string): Promise<void> {
    const current = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { questions: true } } },
    });
    if (!current) throw new NotFoundException('Topic not found');
    const used = current._count.questions;
    if (used > 0) {
      throw new ConflictException(
        `"${current.name}" has ${used} question${used === 1 ? '' : 's'}. Hide it instead, so they keep their topic.`,
      );
    }
    if (current.isActive) await this.assertAnotherActive(id);

    await this.prisma.category.delete({ where: { id } });
    this.changed();
  }

  // -------------------------------------------------------------------- helpers

  private async view(id: string): Promise<ModeratorCategory> {
    const all = await this.findAllForModerator();
    return all.find((c) => c.id === id)!;
  }

  private async assertNameFree(name: string, exceptId?: string) {
    const clash = await this.prisma.category.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (clash)
      throw new ConflictException(`A topic called "${name}" already exists`);
  }

  /** Students must always have at least one topic to pick. */
  private async assertAnotherActive(id: string) {
    const others = await this.prisma.category.count({
      where: { isActive: true, id: { not: id } },
    });
    if (others === 0) {
      throw new ConflictException(
        'Keep at least one topic visible to students',
      );
    }
  }

  private async freeSlug(base: string): Promise<string> {
    const taken = new Set(
      (
        await this.prisma.category.findMany({
          where: { slug: { startsWith: base } },
          select: { slug: true },
        })
      ).map((c) => c.slug),
    );
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++)
      if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }

  private changed() {
    this.realtime.emit(Room.MODERATOR, SocketEvent.CATEGORIES_UPDATED);
  }
}
