/**
 * City of Joondalup scraper tests.
 *
 * Mocked against live endpoint shapes:
 *   - GET /aapi/coj/propertylookup/{address}
 *   - GET /aapi/coj/bindatelookup/{mapkey}
 *
 * No production API calls are made in tests.
 */

const JOONDALUP_BASE = 'https://www.joondalup.wa.gov.au';

const originalFetch = globalThis.fetch;
beforeAll(() => {
  const mockFetch: typeof fetch = async (input) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as { url: string }).url;

    if (url.startsWith(`${JOONDALUP_BASE}/aapi/coj/propertylookup/`)) {
      const query = decodeURIComponent(url.split('/aapi/coj/propertylookup/')[1] ?? '').toLowerCase();

      if (query.includes('fairway') || query.includes('connolly')) {
        return new Response(JSON.stringify([
          { formatted_address: 'Freeway Reserve Mitchell Freeway CONNOLLY WA 6027', house_no: null, locality: 'CONNOLLY', mapkey: '1274988' },
          { formatted_address: '71 Fairway Circle CONNOLLY WA 6027', house_no: 71, locality: 'CONNOLLY', mapkey: '10105' },
        ]), { status: 200 });
      }

      if (query.includes('boas') || query.includes('joondalup')) {
        return new Response(JSON.stringify([
          { formatted_address: 'City Of Joondalup 90 Boas Avenue JOONDALUP WA 6027', house_no: 90, locality: 'JOONDALUP', mapkey: '9394' },
        ]), { status: 200 });
      }

      if (query.includes('king edward') || query.includes('heathridge')) {
        return new Response(JSON.stringify([
          { formatted_address: '1 King Edward Drive HEATHRIDGE WA 6027', house_no: 1, locality: 'HEATHRIDGE', mapkey: '983' },
        ]), { status: 200 });
      }

      return new Response(JSON.stringify([]), { status: 200 });
    }

    if (url.startsWith(`${JOONDALUP_BASE}/aapi/coj/bindatelookup/`)) {
      const mapkey = url.split('/aapi/coj/bindatelookup/')[1] ?? '';

      if (mapkey === '1274988') {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      if (mapkey === '10105') {
        return new Response(JSON.stringify([{
          Rubbish_Day: 'Friday ',
          Next_Recycling_Date: 'Friday 20/03/2026',
          Next_Recycling_Date_CustomValue: '2026-03-20T00:00:00',
        }]), { status: 200 });
      }

      if (mapkey === '9394') {
        return new Response(JSON.stringify([{
          Rubbish_Day: 'Friday ',
          Next_Recycling_Date: 'Friday 27/03/2026',
          Next_Recycling_Date_CustomValue: '2026-03-27T00:00:00',
        }]), { status: 200 });
      }

      if (mapkey === '983') {
        return new Response(JSON.stringify([{
          Rubbish_Day: 'Thursday ',
          Next_Recycling_Date: 'Thursday 19/03/2026',
          Next_Recycling_Date_CustomValue: '2026-03-19T00:00:00',
        }]), { status: 200 });
      }
    }

    return originalFetch(input);
  };

  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});

afterAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { joondalupScraper, joondalupCanHandle } from '../../src/scrapers/joondalup';

describe('JoondalupScraper', () => {
  describe('resolveAddress', () => {
    it('skips non-serviced candidate and resolves Connolly to JOO-FRI-A', async () => {
      const result = await joondalupScraper.resolveAddress('1 Fairway Circle, Connolly WA 6027');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('JOO-FRI-A');
      expect(result.zoneName).toContain('Friday');
      expect(result.councilSlug).toBe('joondalup');
    }, 15_000);

    it('resolves Joondalup civic address to JOO-FRI-B', async () => {
      const result = await joondalupScraper.resolveAddress('90 Boas Avenue, Joondalup WA 6027');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('JOO-FRI-B');
    }, 15_000);

    it('returns error for unsupported address', async () => {
      const result = await joondalupScraper.resolveAddress('1 Queen Street, Fremantle WA 6160');
      expect(result.error).toBeDefined();
      expect(result.zoneCode).toBe('');
    }, 15_000);
  });

  describe('fetchSchedule', () => {
    it('returns weekly red + alternating yellow/green schedule for JOO-THU-A', async () => {
      const s = await joondalupScraper.fetchSchedule('JOO-THU-A');
      expect(s.generalDay).toBe('thursday');
      expect(s.generalFrequency).toBe('weekly');
      expect(s.recyclingDay).toBe('thursday');
      expect(s.recyclingWeek).toBe('A');
      expect(s.greenWasteDay).toBe('thursday');
      expect(s.greenWasteWeek).toBe('B');
    });

    it('returns opposite green week for JOO-FRI-B', async () => {
      const s = await joondalupScraper.fetchSchedule('JOO-FRI-B');
      expect(s.recyclingWeek).toBe('B');
      expect(s.greenWasteWeek).toBe('A');
    });

    it('throws for unknown zone code', async () => {
      await expect(joondalupScraper.fetchSchedule('INVALID')).rejects.toThrow('Unknown Joondalup zone code');
    });
  });

  describe('joondalupCanHandle', () => {
    it('returns true for Joondalup suburbs', () => {
      expect(joondalupCanHandle('Joondalup')).toBe(true);
      expect(joondalupCanHandle('connolly')).toBe(true);
      expect(joondalupCanHandle('KINROSS')).toBe(true);
      expect(joondalupCanHandle('warwick')).toBe(true);
    });

    it('returns false for non-Joondalup suburbs', () => {
      expect(joondalupCanHandle('fremantle')).toBe(false);
      expect(joondalupCanHandle('scarborough')).toBe(false);
      expect(joondalupCanHandle('midland')).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('passes with mocked Joondalup API payloads', async () => {
      const ok = await joondalupScraper.healthCheck();
      expect(ok).toBe(true);
    }, 15_000);
  });
});

