/** Shared types and interfaces for all council scrapers. */

// ─── Zone resolution ──────────────────────────────────────────────────────────

export interface ZoneResolution {
  zoneId?: string;       // database zone ID once persisted
  zoneCode: string;      // council-specific zone code (e.g. "MON-A")
  zoneName: string;      // human-readable zone name
  councilSlug: string;
  error?: string;        // set if resolution failed (do not throw)
}

// ─── Zone schedule ────────────────────────────────────────────────────────────

export interface ZoneScheduleData {
  zoneCode: string;
  zoneName: string;
  generalDay: string;        // 'monday'|'tuesday'|...'friday'
  generalFrequency: string;  // 'weekly'
  recyclingDay: string;
  recyclingWeek: 'A' | 'B' | 'weekly';
  greenWasteDay: string | null;
  greenWasteWeek: 'A' | 'B' | 'weekly' | null;
  vergeDates: string[] | null;
}

// ─── Scraper interface ────────────────────────────────────────────────────────

export interface CouncilScraper {
  readonly councilSlug: string;
  readonly councilName: string;

  /** Resolve a street address to a collection zone. Never throws — errors in ZoneResolution.error. */
  resolveAddress(address: string): Promise<ZoneResolution>;

  /** Return the full schedule data for a zone by its zone code. */
  fetchSchedule(zoneCode: string): Promise<ZoneScheduleData>;

  /** Return true if the scraper is working against live council data. */
  healthCheck(): Promise<boolean>;
}
