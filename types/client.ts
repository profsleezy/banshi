export type UUID = string;
export type Timestamp = string;

export type RiskLevel = 'Healthy' | 'Watch' | 'Risk' | 'Critical';

export interface Client {
  id: UUID;
  user_id: UUID;
  name: string;
  platform: string;
  account_id: string;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  latest_snapshot_metadata?: Record<string, unknown> | null;
  monitoring_enabled?: boolean | null;
  monitoring_updated_at?: Timestamp | null;
  ingest_token_hash?: string | null;
  ingest_token_created_at?: Timestamp | null;
  ingest_token_last_used_at?: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  last_checked?: Timestamp | null;
}

export interface RiskStatus {
  id: UUID;
  client_id: UUID;
  status: RiskLevel;
  score: number;
  notes?: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}
