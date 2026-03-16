export interface CouncilStat {
  id: string;
  name: string;
  slug: string;
  platformType: string;
  zoneCount: number;
  lastScrapedAt: Date | null;
  isActive: boolean;
  hasScraper: boolean;
}

export interface AdminSummary {
  councils: {
    total: number;
    active: number;
    withScrapers: number;
  };
  zones: {
    total: number;
  };
  users: {
    total: number;
    free: number;
    trial: number;
    active: number;
    expired: number;
  };
  holidays: {
    total: number;
  };
  addressCache: {
    total: number;
  };
  topZones: Array<{
    zoneId: string;
    zoneName: string;
    councilName: string;
    userCount: number;
  }>;
}

export interface ZoneListItem {
  id: string;
  zoneName: string;
  zoneCode: string | null;
  generalDay: string;
  recyclingDay: string;
  recyclingWeek: string;
  greenWasteDay: string | null;
  greenWasteWeek: string | null;
  vergeDates: string[];
  council: {
    id: string;
    name: string;
    slug: string;
  };
  userCount: number;
  updatedAt: Date;
}

export interface ZoneDetail extends ZoneListItem {
  generalFrequency: string;
  createdAt: Date;
}

export interface AddressCacheItem {
  id: string;
  addressLabel: string;
  lat: number;
  lng: number;
  cachedAt: Date;
  expiresAt: Date;
  councilName: string;
  zoneId: string;
  zoneName: string;
}

export type PushTokenStatus = 'configured' | 'missing';

export interface UserListItem {
  id: string;
  createdAt: Date;
  subscriptionStatus: string;
  notificationHour: number;
  zoneCount: number;
  pushTokenStatus: PushTokenStatus;
}

export interface UserDetail extends UserListItem {
  zones: Array<{
    zoneId: string;
    zoneName: string;
    councilName: string;
    addressLabel: string;
    isPrimary: boolean;
    createdAt: Date;
  }>;
}

export interface SystemHealthSummary {
  db: {
    status: 'ok' | 'error';
    latencyMs: number | null;
  };
  deployment: {
    env: string;
    serviceName: string;
    gitSha: string;
  };
  adminAuthEnabled: boolean;
}

export interface ScraperRunResult {
  slug: string;
  councilName: string;
  refreshed: number;
  skipped: number;
  errors: string[];
  lastScrapedAt: string | null;
}
