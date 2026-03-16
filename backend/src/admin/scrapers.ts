import prisma from '../utils/prisma';
import { upsertZone } from '../repositories/zoneRepository';
import { SCRAPER_REGISTRY } from '../scrapers/registry';
import { logger } from '../utils/logger';
import type { ScraperRunResult } from './types';

/** Run a live health check for every registered scraper. */
export async function runAllScraperHealthChecks() {
  const results = [];

  for (const slug of Object.keys(SCRAPER_REGISTRY).sort()) {
    const entry = SCRAPER_REGISTRY[slug];

    try {
      const healthy = await entry.scraper.healthCheck();
      results.push({ slug, councilName: entry.scraper.councilName, healthy });
    } catch (err) {
      results.push({
        slug,
        councilName: entry.scraper.councilName,
        healthy: false,
        error: toMessage(err),
      });
    }
  }

  return results;
}

/** Refresh all seeded zones for one council scraper. */
export async function runScraper(slug: string): Promise<ScraperRunResult> {
  const entry = SCRAPER_REGISTRY[slug];
  if (!entry) {
    throw new Error(`No scraper registered for '${slug}'`);
  }

  const council = await prisma.council.findUnique({
    where: { slug },
    include: {
      zones: {
        select: {
          id: true,
          zoneCode: true,
          zoneName: true,
        },
        orderBy: { zoneName: 'asc' },
      },
    },
  });

  if (!council) {
    throw new Error(`Council '${slug}' not found`);
  }

  let refreshed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const zone of council.zones) {
    if (!zone.zoneCode) {
      skipped += 1;
      errors.push(`${zone.zoneName}: missing zone code`);
      continue;
    }

    try {
      const schedule = await entry.scraper.fetchSchedule(zone.zoneCode);
      await upsertZone(council.id, zone.zoneCode, schedule);
      refreshed += 1;
    } catch (err) {
      skipped += 1;
      errors.push(`${zone.zoneCode}: ${toMessage(err)}`);
    }
  }

  const lastScrapedAt = refreshed > 0 ? await touchCouncil(council.id) : council.lastScrapedAt;

  logger.info('Admin scraper run complete', {
    slug,
    refreshed,
    skipped,
    errorCount: errors.length,
  });

  return {
    slug,
    councilName: council.name,
    refreshed,
    skipped,
    errors,
    lastScrapedAt: lastScrapedAt ? lastScrapedAt.toISOString() : null,
  };
}

/** Refresh all registered scrapers sequentially. */
export async function runAllScrapers(): Promise<ScraperRunResult[]> {
  const results: ScraperRunResult[] = [];

  for (const slug of Object.keys(SCRAPER_REGISTRY).sort()) {
    try {
      results.push(await runScraper(slug));
    } catch (err) {
      results.push({
        slug,
        councilName: SCRAPER_REGISTRY[slug].scraper.councilName,
        refreshed: 0,
        skipped: 0,
        errors: [toMessage(err)],
        lastScrapedAt: null,
      });
    }
  }

  return results;
}

/** Update the council's last-scraped timestamp after a successful refresh. */
async function touchCouncil(councilId: string): Promise<Date> {
  const updated = await prisma.council.update({
    where: { id: councilId },
    data: { lastScrapedAt: new Date() },
    select: { lastScrapedAt: true },
  });

  return updated.lastScrapedAt as Date;
}

/** Normalise unknown error values for API responses and logs. */
function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}
