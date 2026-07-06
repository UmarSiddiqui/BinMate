/**
 * Master seed — runs all council seeds + WA public holidays in sequence.
 * Run with: npm run db:seed-all
 *
 * This is the canonical seed for production (Render/Supabase).
 * Each council seed is idempotent — safe to run multiple times.
 */

import { execSync } from 'child_process';
import path from 'path';

const SEEDS = [
  'seed.ts',           // WA public holidays
  'seed-armadale.ts',
  'seed-bassendean.ts',
  'seed-bayswater.ts',
  'seed-belmont.ts',
  'seed-cambridge.ts',
  'seed-canning.ts',
  'seed-claremont.ts',
  'seed-cockburn.ts',
  'seed-cottesloe.ts',
  'seed-eastfremantle.ts',
  'seed-fremantle.ts',
  'seed-gosnells.ts',
  'seed-joondalup.ts',
  'seed-kalamunda.ts',
  'seed-kwinana.ts',
  'seed-melville.ts',
  'seed-mosmanpark.ts',
  'seed-mundaring.ts',
  'seed-nedlands.ts',
  'seed-peppermintgrove.ts',
  'seed-rockingham.ts',
  'seed-serpentinejj.ts',
  'seed-southperth.ts',
  'seed-stirling.ts',
  'seed-subiaco.ts',
  'seed-swan.ts',
  'seed-victoriapark.ts',
  'seed-vincent.ts',
  'seed-wanneroo.ts',
];

const seedDir = path.resolve(__dirname);
let passed = 0;
let failed = 0;

for (const file of SEEDS) {
  const label = file.replace('.ts', '');
  try {
    execSync(`npx tsx "${path.join(seedDir, file)}"`, { stdio: 'inherit', cwd: seedDir, env: process.env });
    passed++;
  } catch {
    console.error(`\n✗ ${label} failed — see output above\n`);
    failed++;
  }
}

console.log(`\n─────────────────────────────────────`);
console.log(`Seed complete: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
