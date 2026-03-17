import type { CouncilScraper } from './base/types';
import { wannerooScraper, wannerooCanHandle } from './wanneroo';
import { armadaleScraper, armadaleCanHandle } from './armadale';
import { fremantleScraper, fremantleCanHandle } from './fremantle';
import { cockburnScraper, cockburnCanHandle } from './cockburn';
import { melvilleScraper, melvilleCanHandle } from './melville';
import { canningScraper, canningCanHandle } from './canning';
import { swanScraper, swanCanHandle } from './swan';
import { southPerthScraper, southPerthCanHandle } from './southperth';
import { stirlingScraper, stirlingCanHandle } from './stirling';
import { nedlandsScraper, nedlandsCanHandle } from './nedlands';
import { subiacoScraper, subiacoCanHandle } from './subiaco';
import { cambridgeScraper, cambridgeCanHandle } from './cambridge';
import { peppermintGroveScraper, peppermintGroveCanHandle } from './peppermintgrove';
import { mosmanParkScraper, mosmanParkCanHandle } from './mosmanpark';
import { joondalupScraper, joondalupCanHandle } from './joondalup';
import { belmontScraper, belmontCanHandle } from './belmont';
import { gosnellsScraper, gosnellsCanHandle } from './gosnells';
import { kalamundaScraper, kalamundaCanHandle } from './kalamunda';
import { bassendeanScraper, bassendeanCanHandle } from './bassendean';
import { bayswaterScraper, bayswaterCanHandle } from './bayswater';
import { vincentScraper, vincentCanHandle } from './vincent';
import { victoriaParkScraper, victoriaParkCanHandle } from './victoriapark';
import { rockinghamScraper, rockinghamCanHandle } from './rockingham';
import { claremontScraper, claremontCanHandle } from './claremont';
import { cottesloeScraper, cottesloeCanHandle } from './cottesloe';
import { eastFremantleScraper, eastFremantleCanHandle } from './eastfremantle';
import { kwinanaScraper, kwinanaCanHandle } from './kwinana';
import { serpentineJJScraper, serpentineJJCanHandle } from './serpentinejj';
import { mundaringScraper, mundaringCanHandle } from './mundaring';

export interface ScraperEntry {
  scraper: CouncilScraper;
  /** Return true if this suburb might belong to this council. O(1) check. */
  canHandle: (suburb: string) => boolean;
}

/**
 * Registered scrapers — pairs each scraper with a cheap suburb-level canHandle
 * check so we don't call every scraper for every address.
 *
 * canHandle is O(1) (hash lookup). The resolveAddress call that follows will
 * geocode the address a second time via Nominatim; acceptable at MVP scale
 * because the address cache means each unique address only pays the cost once.
 *
 * TODO Phase 2: pass pre-geocoded suburb into scrapers to remove double geocode.
 */
export const SCRAPER_REGISTRY: Record<string, ScraperEntry> = {
  wanneroo: {
    scraper: wannerooScraper,
    canHandle: (suburb) => wannerooCanHandle(suburb),
  },
  armadale: {
    scraper: armadaleScraper,
    canHandle: (suburb) => armadaleCanHandle(suburb),
  },
  fremantle: {
    scraper: fremantleScraper,
    canHandle: (suburb) => fremantleCanHandle(suburb),
  },
  cockburn: {
    scraper: cockburnScraper,
    canHandle: (suburb) => cockburnCanHandle(suburb),
  },
  melville: {
    scraper: melvilleScraper,
    canHandle: (suburb) => melvilleCanHandle(suburb),
  },
  canning: {
    scraper: canningScraper,
    canHandle: (suburb) => canningCanHandle(suburb),
  },
  swan: {
    scraper: swanScraper,
    canHandle: (suburb) => swanCanHandle(suburb),
  },
  'south-perth': {
    scraper: southPerthScraper,
    canHandle: (suburb) => southPerthCanHandle(suburb),
  },
  stirling: {
    scraper: stirlingScraper,
    canHandle: (suburb) => stirlingCanHandle(suburb),
  },
  nedlands: {
    scraper: nedlandsScraper,
    canHandle: (suburb) => nedlandsCanHandle(suburb),
  },
  subiaco: {
    scraper: subiacoScraper,
    canHandle: (suburb) => subiacoCanHandle(suburb),
  },
  cambridge: {
    scraper: cambridgeScraper,
    canHandle: (suburb) => cambridgeCanHandle(suburb),
  },
  peppermintgrove: {
    scraper: peppermintGroveScraper,
    canHandle: (suburb) => peppermintGroveCanHandle(suburb),
  },
  mosmanpark: {
    scraper: mosmanParkScraper,
    canHandle: (suburb) => mosmanParkCanHandle(suburb),
  },
  joondalup: {
    scraper: joondalupScraper,
    canHandle: (suburb) => joondalupCanHandle(suburb),
  },
  belmont: {
    scraper: belmontScraper,
    canHandle: (suburb) => belmontCanHandle(suburb),
  },
  gosnells: {
    scraper: gosnellsScraper,
    canHandle: (suburb) => gosnellsCanHandle(suburb),
  },
  kalamunda: {
    scraper: kalamundaScraper,
    canHandle: (suburb) => kalamundaCanHandle(suburb),
  },
  bassendean: {
    scraper: bassendeanScraper,
    canHandle: (suburb) => bassendeanCanHandle(suburb),
  },
  bayswater: {
    scraper: bayswaterScraper,
    canHandle: (suburb) => bayswaterCanHandle(suburb),
  },
  vincent: {
    scraper: vincentScraper,
    canHandle: (suburb) => vincentCanHandle(suburb),
  },
  victoriapark: {
    scraper: victoriaParkScraper,
    canHandle: (suburb) => victoriaParkCanHandle(suburb),
  },
  rockingham: {
    scraper: rockinghamScraper,
    canHandle: (suburb) => rockinghamCanHandle(suburb),
  },
  claremont: {
    scraper: claremontScraper,
    canHandle: (suburb) => claremontCanHandle(suburb),
  },
  cottesloe: {
    scraper: cottesloeScraper,
    canHandle: (suburb) => cottesloeCanHandle(suburb),
  },
  eastfremantle: {
    scraper: eastFremantleScraper,
    canHandle: (suburb) => eastFremantleCanHandle(suburb),
  },
  kwinana: {
    scraper: kwinanaScraper,
    canHandle: (suburb) => kwinanaCanHandle(suburb),
  },
  serpentinejj: {
    scraper: serpentineJJScraper,
    canHandle: (suburb) => serpentineJJCanHandle(suburb),
  },
  mundaring: {
    scraper: mundaringScraper,
    canHandle: (suburb) => mundaringCanHandle(suburb),
  },
};
