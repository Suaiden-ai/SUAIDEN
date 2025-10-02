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


