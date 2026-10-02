/**
 * Idempotent seed: categories (SPEC §3) and, when SEED_* passwords are set,
 * the moderator and host accounts. Safe to re-run; it never deletes data.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { Role } from '../src/generated/prisma/enums.js';

const CATEGORIES = [
  { name: 'General', slug: 'general' },
  { name: 'Career & Studies', slug: 'career-studies' },
  { name: 'Web Development', slug: 'web-development' },
  { name: 'AI & Data', slug: 'ai-data' },
  { name: 'Cybersecurity', slug: 'cybersecurity' },
  { name: 'DevOps & Cloud', slug: 'devops-cloud' },
  { name: 'Mobile Development', slug: 'mobile-development' },
  { name: 'Game Development', slug: 'game-development' },
];

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function seedUser(role: Role, username?: string, password?: string) {
  if (!username || !password) {
    console.log(`- ${role}: skipped (SEED_${role}_USERNAME/PASSWORD not set)`);
    return;
  }
  if (password.length < 10) {
    throw new Error(`SEED_${role}_PASSWORD must be at least 10 characters`);
  }
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`- ${role}: "${username}" already exists, left unchanged`);
    return;
  }
  await prisma.user.create({
    data: { username, role, passwordHash: await argon2.hash(password) },
  });
  console.log(`- ${role}: created "${username}"`);
}

async function main() {
  for (const [index, category] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: { ...category, displayOrder: index + 1 },
      update: { name: category.name, displayOrder: index + 1 },
    });
  }
  console.log(`- ${CATEGORIES.length} categories ready`);

  await seedUser(
    'MODERATOR',
    process.env.SEED_MODERATOR_USERNAME,
    process.env.SEED_MODERATOR_PASSWORD,
  );
  await seedUser(
    'HOST',
    process.env.SEED_HOST_USERNAME,
    process.env.SEED_HOST_PASSWORD,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
