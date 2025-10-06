import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseKey);

export type LeadInsert = {
  name: string;
  email: string;
  whatsapp: string;
  project_description?: string;
  ip_address?: string | null;
  user_agent?: string | null;
  referrer?: string | null;
};

export async function insertLead(data: LeadInsert): Promise<string> {
  const { data: rows, error } = await supabase
    .from('leads')
    .insert({
      name: data.name,
      email: data.email,
      whatsapp: data.whatsapp,
      project_description: data.project_description ?? null,
      ip_address: data.ip_address ?? null,
      user_agent: data.user_agent ?? null,
      referrer: data.referrer ?? null,
    })
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return (rows as any)?.id as string;
}

// ====== Realtime Studio State (JSONB) ======
export type StudioState = {
  initialDesc?: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  proposal?: unknown;
};

export async function upsertStudioState(sessionId: string, state: StudioState, leadId?: string) {
  const { error } = await supabase
    .from('studio_sessions')
    .upsert({ id: sessionId, state, lead_id: leadId ?? null, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw error;
}

export async function fetchStudioState(sessionId: string) {
  const { data, error } = await supabase
    .from('studio_sessions')
    .select('state')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return (data?.state as StudioState) || null;
}

// ====== Rate Limiting Functions ======
export type RateLimitResult = {
  is_blocked: boolean;
  attempt_count: number;
  max_attempts: number;
  remaining_attempts: number;
  reset_time: string;
  time_window_hours: number;
};

export async function checkRateLimit(
  ipAddress: string,
  endpoint: string = 'ai_generation',
  maxAttempts: number = 10,
  timeWindowHours: number = 24
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_ip_address: ipAddress,
    p_endpoint: endpoint,
    p_max_attempts: maxAttempts,
    p_time_window_hours: timeWindowHours
  });
  
  if (error) throw error;
  return data as RateLimitResult;
}

export async function logRequestAttempt(
  ipAddress: string,
  endpoint: string = 'ai_generation',
  userAgent?: string,
  referrer?: string
): Promise<string> {
  const { data, error } = await supabase.rpc('log_request_attempt', {
    p_ip_address: ipAddress,
    p_endpoint: endpoint,
    p_user_agent: userAgent || null,
    p_referrer: referrer || null
  });
  
  if (error) throw error;
  return data as string;
}


