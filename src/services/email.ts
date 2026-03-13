import { supabase } from './supabase';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

const sendEmail = async ({ to, subject, html }: SendEmailParams) => {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: { to, subject, html },
  });

  if (error) {
    console.error('Error sending email:', error);
    throw error;
  }

  return data;
};

export const emailService = {
  async sendCandidateConfirmation(to: string, fullName: string, jobTitle: string) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', sans-serif; background-color: #000; color: #fff; margin: 0; padding: 40px; }
          .container { max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(131, 52, 255, 0.2); border-radius: 40px; padding: 40px; text-align: center; backdrop-filter: blur(20px); }
          .logo-img { width: 180px; margin-bottom: 30px; }
          .logo { font-size: 32px; font-weight: 900; letter-spacing: -1px; margin-bottom: 20px; }
          .logo span { color: #8334FF; }
          h1 { font-size: 28px; font-weight: 900; margin-bottom: 20px; font-style: italic; }
          p { font-size: 18px; line-height: 1.6; color: #a1a1aa; }
          .highlight { color: #fff; font-weight: 700; }
          .badge { display: inline-block; padding: 8px 16px; background: rgba(131, 52, 255, 0.1); border: 1px solid rgba(131, 52, 255, 0.3); color: #8334FF; border-radius: 12px; font-size: 14px; font-weight: 900; text-transform: uppercase; margin: 20px 0; }
          .footer { margin-top: 40px; font-size: 14px; color: #52525b; }
        </style>
      </head>
      <body>
        <div class="container">
          <img src="${window.location.origin}/logo-suaiden.png" alt="Suaiden Logo" class="logo-img">
          <h1>Aplicação <span style="color: #8334FF; font-style: normal;">Recebida!</span></h1>
          <p>Olá, <span class="highlight">${fullName}</span>!</p>
          <p>Confirmamos o recebimento da sua candidatura para a vaga de:</p>
          <div class="badge">${jobTitle}</div>
          <p>Nossa equipe de recrutamento analisará seu perfil cuidadosamente. Caso seu perfil combine com a vaga, entraremos em contato em breve.</p>
          <p>Obrigado por querer fazer parte do futuro da IA com a <span class="highlight">Suaiden</span>.</p>
          <div class="footer">Este é um e-mail automático, por favor não responda.</div>
        </div>
      </body>
      </html>
    `;

    return sendEmail({ to, subject: `Confirmação de Candidatura: ${jobTitle} - Suaiden`, html });
  },

  async sendAdminNotification(to: string, candidate: { fullName: string, email: string, jobTitle: string, id: string }) {
    const dashboardUrl = `${window.location.origin}/admin/candidates`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', sans-serif; background-color: #000; color: #fff; margin: 0; padding: 40px; }
          .container { max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(131, 52, 255, 0.2); border-radius: 40px; padding: 40px; backdrop-filter: blur(20px); }
          .header { text-align: center; margin-bottom: 40px; }
          h1 { font-size: 24px; font-weight: 900; margin-bottom: 10px; }
          .card { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 24px; margin-bottom: 30px; }
          .label { font-size: 12px; font-weight: 900; color: #8334FF; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
          .value { font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 16px; }
          .btn { display: block; width: 100%; padding: 16px; background: #8334FF; color: #fff; text-decoration: none; text-align: center; border-radius: 16px; font-weight: 900; font-size: 16px; box-shadow: 0 10px 20px rgba(131,52,255,0.3); }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${window.location.origin}/logo-suaiden.png" alt="Suaiden Logo" style="width: 150px; margin-bottom: 20px;">
            <h1>Nova <span style="color: #8334FF;">Candidatura</span></h1>
            <p style="color: #a1a1aa;">Um novo talento acaba de se aplicar pelo portal.</p>
          </div>
          
          <div class="card">
            <div class="label">Candidato</div>
            <div class="value">${candidate.fullName}</div>
            
            <div class="label">Vaga</div>
            <div class="value">${candidate.jobTitle}</div>
            
            <div class="label">E-mail de Contato</div>
            <div class="value">${candidate.email}</div>
          </div>
          
          <a href="${dashboardUrl}" class="btn">VER NO DASHBOARD</a>
        </div>
      </body>
      </html>
    `;

    return sendEmail({ to, subject: `NOVA CANDIDATURA: ${candidate.fullName} - ${candidate.jobTitle}`, html });
  }
};
