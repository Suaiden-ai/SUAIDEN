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
/**
 * Captura informações de sessão como fallback
 */
function getSessionInfo() {
  if (typeof window === 'undefined') {
    return {
      session_id: 'unknown',
      landing_page: 'unknown',
      entry_timestamp: 'unknown',
      page_views: 0
    };
  }

  // Gerar ou recuperar session ID
  let sessionId = sessionStorage.getItem('suaiden_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('suaiden_session_id', sessionId);
  }

  // Contar visualizações de página
  const pageViews = parseInt(sessionStorage.getItem('suaiden_page_views') || '0') + 1;
  sessionStorage.setItem('suaiden_page_views', pageViews.toString());

  // Timestamp de entrada na sessão
  let entryTimestamp = sessionStorage.getItem('suaiden_entry_timestamp');
  if (!entryTimestamp) {
    entryTimestamp = new Date().toISOString();
    sessionStorage.setItem('suaiden_entry_timestamp', entryTimestamp);
  }

  return {
    session_id: sessionId,
    landing_page: window.location.href,
    entry_timestamp: entryTimestamp,
    page_views: pageViews
  };
}

/**
 * Captura parâmetros UTM de forma mais robusta
 */
function getUtmInfo() {
  if (typeof window === 'undefined') {
    return {
      utm_source: undefined,
      utm_medium: undefined,
      utm_campaign: undefined,
      utm_term: undefined,
      utm_content: undefined,
      has_utm: false
    };
  }

  const urlParams = new URLSearchParams(window.location.search);
  const utmParams = {
    utm_source: urlParams.get('utm_source') || undefined,
    utm_medium: urlParams.get('utm_medium') || undefined,
    utm_campaign: urlParams.get('utm_campaign') || undefined,
    utm_term: urlParams.get('utm_term') || undefined,
    utm_content: urlParams.get('utm_content') || undefined,
  };

  const hasUtm = Object.values(utmParams).some(value => value !== undefined);

  return {
    ...utmParams,
    has_utm: hasUtm
  };
}

/**
 * Captura informações de referência de forma mais robusta
 */
function getReferrerInfo() {
  if (typeof document === 'undefined') {
    return {
      referrer: 'unknown',
      referrer_domain: 'unknown',
      has_referrer: false,
      referrer_source: 'none'
    };
  }

  const referrer = document.referrer;
  const hasReferrer = referrer && referrer.length > 0;
  
  let referrerDomain = 'unknown';
  let referrerSource = 'none';
  
  if (hasReferrer) {
    try {
      const referrerUrl = new URL(referrer);
      referrerDomain = referrerUrl.hostname;
      
      // Classificar o tipo de referrer
      if (referrerDomain.includes('google')) {
        referrerSource = 'google';
      } else if (referrerDomain.includes('facebook')) {
        referrerSource = 'facebook';
      } else if (referrerDomain.includes('instagram')) {
        referrerSource = 'instagram';
      } else if (referrerDomain.includes('linkedin')) {
        referrerSource = 'linkedin';
      } else if (referrerDomain.includes('twitter') || referrerDomain.includes('x.com')) {
        referrerSource = 'twitter';
      } else if (referrerDomain.includes('youtube')) {
        referrerSource = 'youtube';
      } else if (referrerDomain.includes('tiktok')) {
        referrerSource = 'tiktok';
      } else if (referrerDomain === window.location.hostname) {
        referrerSource = 'internal';
      } else {
        referrerSource = 'external';
      }
    } catch (error) {
      console.warn('Erro ao processar referrer:', error);
      referrerDomain = 'invalid';
      referrerSource = 'invalid';
    }
  }

  return {
    referrer: referrer || 'none',
    referrer_domain: referrerDomain,
    has_referrer: hasReferrer,
    referrer_source: referrerSource
  };
}

export async function sendNewLead(payload: NewLeadPayload): Promise<Response> {
  const baseUrl = import.meta.env.VITE_N8N_URL as string | undefined;
  if (!baseUrl) {
    throw new Error('VITE_N8N_URL não configurado');
  }

  const url = `${baseUrl.replace(/\/?$/, '/')}novo-lead`;

  // Capturar informações de UTM, referrer e sessão de forma robusta
  const utmInfo = getUtmInfo();
  const referrerInfo = getReferrerInfo();
  const sessionInfo = getSessionInfo();

  // Log para debug (remover em produção)
  console.log('UTM Info:', utmInfo);
  console.log('Referrer Info:', referrerInfo);
  console.log('Session Info:', sessionInfo);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      ...utmInfo,
      submittedAt: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      pageUrl: typeof window !== 'undefined' ? window.location.href : 'unknown',
      // Informações de referência melhoradas
      ...referrerInfo,
      // Informações de sessão como fallback
      ...sessionInfo,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Falha ao enviar lead (${res.status}): ${text}`);
  }

  return res;
}


