export interface ConsultationSchedulePayload {
  name?: string;
  contact_email: string;
  phone_number?: string;
  preferred_datetime: string; // ISO full
  preferred_date: string; // yyyy-mm-dd
  preferred_time: string; // HH:mm
  brazil_time: string; // HH:mm
  utc_time: string; // HH:mm
  user_timezone: string;
  debug_datetime_utc: string; // ISO Z
  debug_timezone_info: {
    user_timezone: string;
    brazil_offset: string;
    conversion_explanation: string;
  };
  source?: string;
}

export interface NewLeadPayload {
  name: string;
  email: string;
  whatsapp: string;
  source?: string;
  project_description?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

/**
 * Sends a schedule request to the N8N webhook defined by VITE_N8N_URL.
 * The final URL is `${VITE_N8N_URL}agendar-consultoria`.
 */
export async function sendConsultationSchedule(payload: ConsultationSchedulePayload): Promise<Response> {
  const baseUrl = import.meta.env.VITE_N8N_URL as string | undefined;
  if (!baseUrl) {
    throw new Error('VITE_N8N_URL não configurado');
  }

  const url = `${baseUrl.replace(/\/?$/, '/') }agendar-consultoria`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      submittedAt: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Falha ao enviar agendamento (${res.status}): ${text}`);
  }

  return res;
}

/**
 * Sends a new lead to the N8N webhook defined by VITE_N8N_URL.
 * The final URL is `${VITE_N8N_URL}novo-lead`.
 */
export async function sendNewLead(payload: NewLeadPayload): Promise<Response> {
  const baseUrl = import.meta.env.VITE_N8N_URL as string | undefined;
  if (!baseUrl) {
    throw new Error('VITE_N8N_URL não configurado');
  }

  const url = `${baseUrl.replace(/\/?$/, '/')}novo-lead`;

  // Extrair parâmetros UTM da URL
  const urlParams = new URLSearchParams(window.location.search);
  const utmParams = {
    utm_source: urlParams.get('utm_source') || undefined,
    utm_medium: urlParams.get('utm_medium') || undefined,
    utm_campaign: urlParams.get('utm_campaign') || undefined,
    utm_term: urlParams.get('utm_term') || undefined,
    utm_content: urlParams.get('utm_content') || undefined,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      ...utmParams,
      submittedAt: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      referrer: typeof document !== 'undefined' ? document.referrer : 'unknown',
      pageUrl: typeof window !== 'undefined' ? window.location.href : 'unknown',
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Falha ao enviar lead (${res.status}): ${text}`);
  }

  return res;
}


