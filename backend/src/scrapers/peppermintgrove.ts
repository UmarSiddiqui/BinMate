/**
 * Shire of Peppermint Grove — bin collection scraper.
 *
 * Data source: official 2026 recycling calendar PDF:
 * https://www.peppermintgrove.wa.gov.au/Profiles/sopg/Assets/ClientData/Recycling_Calendar_2026_-_Shire_of_Peppermint_Grove.pdf
 *
 * The calendar shows one shire-wide schedule:
 *   - FOGO (lime green lid): weekly
 *   - General waste (red lid): weekly
 *   - Recycling (yellow lid): fortnightly on Fridays
 *
 * Highlighted recycling dates in the official 2026 calendar include:
 *   2026-01-02, 2026-01-16, 2026-01-30, ...
 * Using BinMate's Week-A reference Monday (2026-01-05), Friday 2026-01-16 is Week B.
 *
 * Zone code convention: PEP-FRI-B
 */

import { geocodeAddress } from '../services/geocoding';
import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

const COUNCIL_SLUG = 'peppermintgrove';
const ZONE_CODE = 'PEP-FRI-B';
const ZONE_NAME = 'Shire of Peppermint Grove — Friday (recycling Week B)';

const PEPPERMINT_GROVE_SUBURBS = new Set(['peppermint grove']);

class PeppermintGroveScraper implements CouncilScraper {
  readonly councilSlug = COUNCIL_SLUG;
  readonly councilName = 'Shire of Peppermint Grove';

  /** Resolve any Peppermint Grove address to the shire-wide Friday schedule. */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const geo = await geocodeAddress(address);
      if (!geo) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Could not geocode address' };
      }

      if (!peppermintGroveCanHandle(geo.suburb)) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not in Peppermint Grove service area' };
      }

      return {
        zoneCode: ZONE_CODE,
        zoneName: ZONE_NAME,
        councilSlug: this.councilSlug,
      };
    } catch (err) {
      logger.error('Peppermint Grove resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return the shire-wide fixed schedule. */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    if (zoneCode !== ZONE_CODE) {
      throw new Error(`Unknown Peppermint Grove zone code: ${zoneCode}`);
    }

    return {
      zoneCode,
      zoneName: ZONE_NAME,
      generalDay: 'friday',
      generalFrequency: 'weekly',
      recyclingDay: 'friday',
      recyclingWeek: 'B',
      greenWasteDay: 'friday',
      greenWasteWeek: 'weekly',
      vergeDates: null,
    };
  }

  /** Confirm the fixed shire-wide zone can be resolved from a known address. */
  async healthCheck(): Promise<boolean> {
    const result = await this.resolveAddress('1 Leake Street Peppermint Grove WA 6011');
    return !result.error && result.zoneCode === ZONE_CODE;
  }
}

export const peppermintGroveScraper = new PeppermintGroveScraper();

/** Return true when a suburb may be serviced by the Shire of Peppermint Grove. */
export function peppermintGroveCanHandle(suburb: string): boolean {
  return PEPPERMINT_GROVE_SUBURBS.has(suburb.trim().toLowerCase());
}
