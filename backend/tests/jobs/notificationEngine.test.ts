/**
 * Notification engine tests — mocked date/zone scenarios per CLAUDE.md §12.
 * Verifies fan-out behaviour and that push copy matches BRAND.md §7
 * ("Bins out tonight" / "{binTypes} bins. {councilName}. Out by 6am tomorrow.").
 */
import { runNotificationEngine } from '../../src/jobs/notificationEngine';
import { sendPushNotification } from '../../src/services/notifications';
import { findUsersForZone } from '../../src/repositories/userRepository';
import { getZonesCollectingTomorrow } from '../../src/services/scheduleService';

jest.mock('../../src/services/notifications', () => ({
  sendPushNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/repositories/userRepository', () => ({
  findUsersForZone: jest.fn(),
}));
jest.mock('../../src/services/scheduleService', () => ({
  getZonesCollectingTomorrow: jest.fn(),
}));

const mockSend = sendPushNotification as jest.Mock;
const mockUsers = findUsersForZone as jest.Mock;
const mockZones = getZonesCollectingTomorrow as jest.Mock;

const collection = (types: string[], isHolidayShifted = false) => ({
  date: '2026-07-07',
  dayOfWeek: 'Tuesday',
  types,
  isHolidayShifted,
  eventType: 'kerbside',
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('runNotificationEngine', () => {
  it('sends BRAND.md §7 night-before copy to every user in a collecting zone', async () => {
    mockZones.mockResolvedValue([
      {
        zoneId: 'zone-1',
        councilName: 'City of Stirling',
        collections: [collection(['general', 'recycling'])],
      },
    ]);
    mockUsers.mockResolvedValue([{ pushToken: 'tok-a' }, { pushToken: 'tok-b' }]);

    await runNotificationEngine();

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledWith('tok-a', {
      title: 'Bins out tonight',
      body: 'Red + Yellow bins. City of Stirling. Out by 6am tomorrow.',
    });
  });

  it('labels FOGO and green waste bins by lid colour', async () => {
    mockZones.mockResolvedValue([
      {
        zoneId: 'zone-2',
        councilName: 'City of Melville',
        collections: [collection(['fogo', 'green_waste'])],
      },
    ]);
    mockUsers.mockResolvedValue([{ pushToken: 'tok-c' }]);

    await runNotificationEngine();

    expect(mockSend).toHaveBeenCalledWith('tok-c', {
      title: 'Bins out tonight',
      body: 'Lime + Green bins. City of Melville. Out by 6am tomorrow.',
    });
  });

  it('sends nothing when no zone collects tomorrow (e.g. Sunday)', async () => {
    mockZones.mockResolvedValue([]);

    await runNotificationEngine();

    expect(mockUsers).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips zones with no subscribed users', async () => {
    mockZones.mockResolvedValue([
      {
        zoneId: 'zone-3',
        councilName: 'City of Bayswater',
        collections: [collection(['general'])],
      },
    ]);
    mockUsers.mockResolvedValue([]);

    await runNotificationEngine();

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('continues sending after an individual push failure', async () => {
    mockZones.mockResolvedValue([
      {
        zoneId: 'zone-4',
        councilName: 'City of Swan',
        collections: [collection(['general'], true)],
      },
    ]);
    mockUsers.mockResolvedValue([{ pushToken: 'tok-bad' }, { pushToken: 'tok-good' }]);
    mockSend.mockRejectedValueOnce(new Error('APNs unavailable'));

    await runNotificationEngine();

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenLastCalledWith('tok-good', {
      title: 'Bins out tonight',
      body: 'Red bin. City of Swan. Out by 6am tomorrow.',
    });
  });
});
