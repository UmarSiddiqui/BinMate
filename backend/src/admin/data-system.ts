import prisma from '../utils/prisma';
import type { SystemHealthSummary } from './types';

/** Return database and deployment health for the admin panel. */
export async function getSystemHealthSummary(): Promise<SystemHealthSummary> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      db: { status: 'ok', latencyMs: Date.now() - start },
      deployment: getDeployment(),
      adminAuthEnabled: Boolean(process.env.ADMIN_PASSWORD),
    };
  } catch {
    return {
      db: { status: 'error', latencyMs: null },
      deployment: getDeployment(),
      adminAuthEnabled: Boolean(process.env.ADMIN_PASSWORD),
    };
  }
}

/** Return deployment metadata for admin surfaces. */
function getDeployment() {
  return {
    env: process.env.NODE_ENV ?? 'development',
    serviceName: process.env.RENDER_SERVICE_NAME ?? 'local',
    gitSha: process.env.RENDER_GIT_COMMIT ?? 'local',
  };
}
