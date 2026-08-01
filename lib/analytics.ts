import { neon } from "@neondatabase/serverless";

/**
 * Server-side analytics against Neon Postgres.
 *
 * This lives on the server because a Postgres connection string is a secret; the
 * previous implementation ran in the browser against a Supabase project that had
 * since been deleted, and every write failed into a swallowed catch for weeks
 * without anyone noticing. Failures here are logged loudly for that reason.
 */

export type EventType =
  | "page_view"
  | "compile"
  | "deploy"
  | "audit"
  | "parallel_analysis"
  | "gas_profile"
  | "migration"
  | "ai_generate"
  | "transpile"
  | "interact_read"
  | "interact_write"
  | "wallet_connect";

export type EventStatus = "success" | "error";

export interface TrackedEvent {
  visitorId: string;
  type: EventType;
  status?: EventStatus;
  durationMs?: number;
  detail?: Record<string, unknown>;
  walletAddress?: string;
}

export interface DeploymentRecord {
  visitorId: string;
  contractAddress: string;
  contractName?: string;
  txHash: string;
  deployerAddress: string;
  gasUsed?: string;
  chainId?: number;
}

/** Null when DATABASE_URL is absent, so local development runs without a database. */
function client() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

export function analyticsConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Upserts the visitor, so first_seen survives and last_seen advances. */
async function touchVisitor(visitorId: string, walletAddress?: string): Promise<void> {
  const sql = client();
  if (!sql) return;

  await sql`
    INSERT INTO users (visitor_id, wallet_address)
    VALUES (${visitorId}, ${walletAddress ?? null})
    ON CONFLICT (visitor_id) DO UPDATE
      SET last_seen_at  = NOW(),
          session_count = users.session_count + 1,
          -- Never overwrite a known wallet with null: a later anonymous event
          -- would otherwise erase the identity of someone who did connect.
          wallet_address = COALESCE(EXCLUDED.wallet_address, users.wallet_address)
  `;
}

export async function trackEvent(event: TrackedEvent): Promise<boolean> {
  const sql = client();
  if (!sql) return false;

  try {
    await touchVisitor(event.visitorId, event.walletAddress);
    await sql`
      INSERT INTO events (visitor_id, event_type, status, duration_ms, detail)
      VALUES (
        ${event.visitorId},
        ${event.type},
        ${event.status ?? "success"},
        ${event.durationMs ?? null},
        ${JSON.stringify(event.detail ?? {})}
      )
    `;
    return true;
  } catch (error) {
    // Analytics must never break the feature it measures, but a silent failure
    // is what made the previous system useless, so this is always reported.
    console.error("Analytics write failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

export async function recordDeployment(record: DeploymentRecord): Promise<boolean> {
  const sql = client();
  if (!sql) return false;

  try {
    await touchVisitor(record.visitorId, record.deployerAddress);
    await sql`
      INSERT INTO deployments (
        visitor_id, contract_address, contract_name, tx_hash,
        deployer_address, chain_id, gas_used
      )
      VALUES (
        ${record.visitorId}, ${record.contractAddress}, ${record.contractName ?? null},
        ${record.txHash}, ${record.deployerAddress}, ${record.chainId ?? 10143},
        ${record.gasUsed ?? null}
      )
      ON CONFLICT (tx_hash) DO NOTHING
    `;
    return true;
  } catch (error) {
    console.error("Deployment write failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

export interface StatsSummary {
  totalUsers: number;
  walletUsers: number;
  activeLast7Days: number;
  activeLast24Hours: number;
  totalEvents: number;
  totalDeployments: number;
  eventBreakdown: { type: string; count: number; errors: number }[];
  dailyActive: { day: string; users: number; events: number }[];
  recentDeployments: {
    contractName: string | null;
    contractAddress: string;
    txHash: string;
    createdAt: string;
  }[];
  firstEventAt: string | null;
}

/**
 * Everything needed to answer "how many people use this and what do they do"
 * in one round trip, so the dashboard is a single query rather than a dozen.
 */
export async function getStats(): Promise<StatsSummary | null> {
  const sql = client();
  if (!sql) return null;

  const [totals] = await sql`
    SELECT
      (SELECT COUNT(*) FROM users)                                              AS total_users,
      (SELECT COUNT(*) FROM users WHERE wallet_address IS NOT NULL)             AS wallet_users,
      (SELECT COUNT(*) FROM users WHERE last_seen_at > NOW() - INTERVAL '7 days')  AS active_7d,
      (SELECT COUNT(*) FROM users WHERE last_seen_at > NOW() - INTERVAL '1 day')   AS active_24h,
      (SELECT COUNT(*) FROM events)                                             AS total_events,
      (SELECT COUNT(*) FROM deployments)                                        AS total_deployments,
      (SELECT MIN(created_at) FROM events)                                      AS first_event_at
  `;

  const breakdown = await sql`
    SELECT event_type,
           COUNT(*)                                   AS count,
           COUNT(*) FILTER (WHERE status = 'error')   AS errors
    FROM events
    GROUP BY event_type
    ORDER BY count DESC
  `;

  const daily = await sql`
    SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
           COUNT(DISTINCT visitor_id)                           AS users,
           COUNT(*)                                             AS events
    FROM events
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY 1
    ORDER BY 1 DESC
  `;

  const recent = await sql`
    SELECT contract_name, contract_address, tx_hash, created_at
    FROM deployments
    ORDER BY created_at DESC
    LIMIT 10
  `;

  return {
    totalUsers: Number(totals.total_users),
    walletUsers: Number(totals.wallet_users),
    activeLast7Days: Number(totals.active_7d),
    activeLast24Hours: Number(totals.active_24h),
    totalEvents: Number(totals.total_events),
    totalDeployments: Number(totals.total_deployments),
    firstEventAt: totals.first_event_at ? new Date(totals.first_event_at).toISOString() : null,
    eventBreakdown: breakdown.map((row) => ({
      type: String(row.event_type),
      count: Number(row.count),
      errors: Number(row.errors),
    })),
    dailyActive: daily.map((row) => ({
      day: String(row.day),
      users: Number(row.users),
      events: Number(row.events),
    })),
    recentDeployments: recent.map((row) => ({
      contractName: row.contract_name ? String(row.contract_name) : null,
      contractAddress: String(row.contract_address),
      txHash: String(row.tx_hash),
      createdAt: new Date(row.created_at).toISOString(),
    })),
  };
}
