/**
 * Builds of the simulated bMS releases
 */

import { BmsVersion } from './ProfileManager';

/**
 * The version GET /v2.0/ManagementServer reports per simulated release. Clients detect the
 * bMS release from its first two parts (26.2 → 26R2, 26.1 → 26R1, 25.2 → 25R2; bConnect-MCP#159).
 * 26R1 is the value a live 26R1 returns. 26R2 is the build of the 26R2 release (MA); a live
 * pre-release 26R2 (26.2.110.0, probed 2026-11-05) answered the same format. The 25R2 value is
 * not confirmed on a live system.
 */
export const MANAGEMENT_SERVER_VERSIONS: Record<BmsVersion, string> = {
  [BmsVersion.BMS_25R2]: '25.2.0.0',
  [BmsVersion.BMS_26R1]: '26.1.161.0',
  [BmsVersion.BMS_26R2]: '26.2.137.0',
};

/** The release before each one: some agents are not updated yet */
const PREVIOUS: Record<BmsVersion, BmsVersion> = {
  [BmsVersion.BMS_25R2]: BmsVersion.BMS_25R2,
  [BmsVersion.BMS_26R1]: BmsVersion.BMS_25R2,
  [BmsVersion.BMS_26R2]: BmsVersion.BMS_26R1,
};

/**
 * The client agent version of an endpoint, as a live bMS reports it (probes of a live 26R1 and a
 * live 26R2): Windows agents the build of the release or, for about one in five, of the one
 * before; the agents of Macs and mobile devices major.minor of the release ("26.2"); Linux
 * endpoints none, managed by SSH or by agent.
 */
export function clientAgentVersion(platform: 'windows' | 'apple' | 'android' | 'linux', release: BmsVersion, h: number): string | null {
  if (platform === 'linux') { return null; }
  const current = MANAGEMENT_SERVER_VERSIONS[release];
  if (platform !== 'windows') { return current.split('.').slice(0, 2).join('.'); }
  return h % 5 === 0 ? MANAGEMENT_SERVER_VERSIONS[PREVIOUS[release]] : current;
}
