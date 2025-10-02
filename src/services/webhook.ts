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


