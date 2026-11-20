import type { FindingSeverity } from '../lib/scoring.ts';

export interface OsvQueryPackage {
  name: string;
  version: string;
  ecosystem: string;
}

export interface OsvVulnerabilitySummary {
  id: string;
  summary: string;
  severity: FindingSeverity;
  fixedVersion?: string;
}

function mapCvssOrSeverity(vuln: {
  database_specific?: { severity?: string };
  severity?: Array<{ score?: string }>;
}): FindingSeverity {
  const dbSev = vuln.database_specific?.severity?.toUpperCase();
  if (dbSev === 'CRITICAL') return 'critical';
  if (dbSev === 'HIGH') return 'high';
  if (dbSev === 'MODERATE' || dbSev === 'MEDIUM') return 'medium';
  if (dbSev === 'LOW') return 'low';
  return 'medium';
}

export async function queryOsvBatch(packages: OsvQueryPackage[]): Promise<{
  results: Record<string, OsvVulnerabilitySummary[]>;
  skippedReason?: string;
}> {
  if (packages.length === 0) {
    return { results: {} };
  }

  const bounded = packages.slice(0, 60);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch('https://api.osv.dev/v1/querybatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: bounded.map((p) => ({
          package: { name: p.name, ecosystem: p.ecosystem },
          version: p.version,
        })),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        results: {},
        skippedReason: `OSV API returned HTTP ${response.status}; live vulnerability lookup skipped.`,
      };
    }

    const json = (await response.json()) as {
      results: Array<{
        vulns?: Array<{
          id: string;
          summary?: string;
          details?: string;
          database_specific?: { severity?: string };
          affected?: Array<{
            ranges?: Array<{ events?: Array<{ fixed?: string }> }>;
          }>;
        }>;
      }>;
    };

    const output: Record<string, OsvVulnerabilitySummary[]> = {};
    bounded.forEach((pkg, idx) => {
      const vulns = json.results?.[idx]?.vulns || [];
      if (vulns.length > 0) {
        const key = `${pkg.ecosystem}:${pkg.name}@${pkg.version}`;
        output[key] = vulns.slice(0, 5).map((v) => {
          const fixed = v.affected?.[0]?.ranges?.[0]?.events?.find((e) => e.fixed)?.fixed;
          return {
            id: v.id,
            summary: v.summary || v.details?.slice(0, 220) || `Advisory ${v.id} affects ${pkg.name}@${pkg.version}`,
            severity: mapCvssOrSeverity(v),
            fixedVersion: fixed,
          };
        });
      }
    });

    return { results: output };
  } catch (error) {
    return {
      results: {},
      skippedReason: `OSV vulnerability lookup unreachable (${error instanceof Error ? error.message : 'network error'}).`,
    };
  } finally {
    clearTimeout(timeout);
  }
}
