/**
 * Creates an internal account, or resets its password if it exists
 * (e.g. backup moderator/host credentials for event day).
 *
 *   npm run user:create -- <username> <MODERATOR|HOST>
 *
 * The password is read from the PASSWORD env var, or prompted for.
 */
import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { Role } from '../src/generated/prisma/enums.js';

async function readPassword(): Promise<string> {
  if (process.env.PASSWORD) return process.env.PASSWORD;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = await rl.question('Password (min 10 chars): ');
  rl.close();
  return password;
}

async function main() {
  const [username, roleArg] = process.argv.slice(2);
  const role = roleArg?.toUpperCase() as Role | undefined;
  if (!username || !role || !(role in Role)) {
    throw new Error(
      'Usage: npm run user:create -- <username> <MODERATOR|HOST>',
    );
  }

  const password = await readPassword();
  if (password.length < 10)
    throw new Error('Password must be at least 10 characters');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.upsert({
      where: { username },
      create: { username, role, passwordHash },
      update: { role, passwordHash },
    });
    console.log(`Saved ${user.role} account "${user.username}"`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
