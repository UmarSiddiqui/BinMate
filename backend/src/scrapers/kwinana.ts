import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';
import {
  ABBREV_TO_DAY,
  DAY_TO_ABBREV,
  MAX_CANDIDATES,
  type WeekToken,
  activateModule,
  createSession,
  fetchPropertyFields,
  parseCollectionPattern,
  resolveSearchCandidates,
  scoreCandidate,
  weekTokenToSchedule,
} from './kwinana.helpers';

const KWINANA_SUBURBS = new Set([
  'anketell',
  'bertram',
  'calista',
  'casuarina',
  'hope valley',
  'kwinana beach',
  'kwinana town centre',
  'leda',
  'mandogalup',
  'medina',
  'orelia',
  'parmelia',
  'postans',
  'the spectacles',
  'wellard',
]);

class KwinanaScraper implements CouncilScraper {
  readonly councilSlug = 'kwinana';
  readonly councilName = 'City of Kwinana';

  /** Resolve an address via Kwinana's T1Cloud IntraMaps flow. */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const session = await createSession();
      await activateModule(session);

      const candidates = await resolveSearchCandidates(address, session);
      if (!candidates.length) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in Kwinana service area' };
      }

      const ranked = [...candidates]
        .sort((a, b) => scoreCandidate(address, b) - scoreCandidate(address, a))
        .slice(0, MAX_CANDIDATES);

      for (const candidate of ranked) {
        const fields = await fetchPropertyFields(candidate, session);
        const pattern = parseCollectionPattern(fields);
        if (!pattern) continue;

        const dayAbbrev = DAY_TO_ABBREV[pattern.day];
        if (!dayAbbrev) continue;

        const dayLabel = pattern.day.charAt(0).toUpperCase() + pattern.day.slice(1);
        const zoneCode = `KWN-${dayAbbrev}-${pattern.recycleWeek}-${pattern.goWeek}`;
        const zoneName = `${this.councilName} — ${dayLabel} (recycling ${pattern.recycleWeek}, GO ${pattern.goWeek})`;
        return { zoneCode, zoneName, councilSlug: this.councilSlug };
      }

      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address found but collection pattern is unsupported' };
    } catch (err) {
      logger.error('Kwinana resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return static schedule metadata for zone code KWN-{DAY}-{A|B|W}-{A|B|W}. */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^KWN-(MON|TUE|WED|THU|FRI)-(A|B|W)-(A|B|W)$/);
    if (!match) throw new Error(`Unknown Kwinana zone code: ${zoneCode}`);

    const day = ABBREV_TO_DAY[match[1]];
    const recyclingToken = match[2] as WeekToken;
    const goToken = match[3] as WeekToken;
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

    return {
      zoneCode,
      zoneName: `${this.councilName} — ${dayLabel} (recycling ${recyclingToken}, GO ${goToken})`,
      generalDay: day,
      generalFrequency: 'weekly',
      recyclingDay: day,
      recyclingWeek: weekTokenToSchedule(recyclingToken),
      greenWasteDay: day,
      greenWasteWeek: weekTokenToSchedule(goToken),
      vergeDates: null,
    };
  }

  /** Health check using a known Kwinana residential address shape from live T1Cloud data. */
  async healthCheck(): Promise<boolean> {
    const result = await this.resolveAddress('23 Adamson Road PARMELIA WA 6167');
    return !result.error && /^KWN-(MON|TUE|WED|THU|FRI)-(A|B|W)-(A|B|W)$/.test(result.zoneCode);
  }
}

export const kwinanaScraper = new KwinanaScraper();

/** Return true when a suburb may be serviced by the City of Kwinana. */
export function kwinanaCanHandle(suburb: string): boolean {
  return KWINANA_SUBURBS.has(suburb.trim().toLowerCase());
}
