import { execSync } from 'node:child_process';
import { loadEnv } from 'vite';

/** Brings the test database schema up to date before the suite runs. */
export default function setup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'ignore',
    env: { ...process.env, ...loadEnv('test', process.cwd(), '') },
  });
}
