import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { solidIcons } from '../../lib/icons';

interface SchedulingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (data: SchedulingData) => void;
  initialName?: string;
  initialEmail?: string;
  initialPhone?: string;
}

interface SchedulingData {
  name: string;
  email: string;
  phone?: string;
  date: string;
  time: string;
}

const SchedulingModal: React.FC<SchedulingModalProps> = ({ isOpen, onClose, onSchedule, initialName, initialEmail, initialPhone }) => {
  const [formData, setFormData] = useState<SchedulingData>({
    name: '',
    email: '',
    phone: '',
    date: '',
    time: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Prefill when modal opens
  useEffect(() => {
    if (!isOpen) return;
    try {
      const leadInfoRaw = localStorage.getItem('leadInfo');
      let leadInfo: any = null;
      try { leadInfo = leadInfoRaw ? JSON.parse(leadInfoRaw) : null; } catch {}
      const storedName = initialName || (leadInfo?.name as string) || localStorage.getItem('lead_name') || localStorage.getItem('user_name') || '';
      const storedEmail = initialEmail || (leadInfo?.email as string) || localStorage.getItem('lead_email') || localStorage.getItem('user_email') || '';
      const storedPhone = initialPhone || (leadInfo?.whatsapp as string) || localStorage.getItem('lead_phone') || localStorage.getItem('user_phone') || '';
      setFormData(prev => ({ ...prev, name: storedName || prev.name, email: storedEmail || prev.email, phone: storedPhone || prev.phone }));
    } catch {}
  }, [isOpen, initialName, initialEmail, initialPhone]);

  const availableTimes = [
    '09:00', '10:00', '11:00', '13:00',
    '14:00', '15:00', '16:00', '17:00'
  ];

  const handleInputChange = (field: keyof SchedulingData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      onSchedule(formData);
      // Monta payload com conversões de horário
      const userTimezone = (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
      const localDateTime = new Date(`${formData.date}T${formData.time}:00`);
      const fmt = (tz: string) => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(localDateTime);
      const brazilTime = fmt('America/Sao_Paulo');
      const utcTime = fmt('UTC');
      const preferredDatetimeIso = localDateTime.toISOString();

      const explanation = `${formData.time} ${userTimezone} → ${brazilTime} Brasil`;

      // Envia ao webhook (melhor esforço; erros não bloqueiam fechamento)
      const { sendConsultationSchedule } = await import('../../services/webhook');
      const res = await sendConsultationSchedule({
        name: formData.name,
        contact_email: formData.email,
        phone_number: formData.phone || undefined,
        preferred_datetime: preferredDatetimeIso,
        preferred_date: formData.date,
        preferred_time: formData.time,
        brazil_time: brazilTime,
        utc_time: utcTime,
        user_timezone: userTimezone,
        debug_datetime_utc: new Date(localDateTime.getTime() - localDateTime.getTimezoneOffset() * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        debug_timezone_info: {
          user_timezone: userTimezone,
          brazil_offset: 'auto',
          conversion_explanation: explanation
        },
        source: 'services-section-modal'
      } as any);

      let message: any = null;
      try { message = await res.json(); } catch {}

      if (message?.response === 'Appointment created successfully.') {
        setFeedback({ type: 'success', text: 'Agendamento confirmado! Enviaremos os detalhes no seu e-mail.' });
        // Persist contact for future prefill
        try {
          localStorage.setItem('lead_name', formData.name);
          localStorage.setItem('lead_email', formData.email);
          if (formData.phone) localStorage.setItem('lead_phone', formData.phone);
        } catch {}
        // Fecha após breve confirmação visual
        setTimeout(() => {
          onClose();
          setFormData({ name: '', email: '', phone: '', date: '', time: '' });
          setFeedback(null);
        }, 3000);
      } else if (message?.response === 'Please try another appointment time, this one is busy.') {
        setFeedback({ type: 'error', text: 'Este horário já está ocupado. Por favor, escolha outro horário.' });
        return; // mantém modal aberto
      } else {
        setFeedback({ type: 'error', text: 'Não foi possível confirmar o agendamento agora. Tente novamente.' });
        return; // mantém modal aberto
      }
    } catch (err) {
      setFeedback({ type: 'error', text: 'Ocorreu um erro ao enviar o agendamento. Tente novamente.' });
      return;
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = formData.date !== '' && formData.time !== '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agendar Consultoria" size="md">
      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-6">
         {/* Texto persuasivo - mais compacto no mobile */}
         <div className="bg-gradient-to-r from-primary-500/10 to-accent-500/10 border border-primary-500/20 rounded-lg p-2 sm:p-4">
           <div className="flex items-start space-x-2 sm:space-x-3">
             
             <div className="text-left">
               <h4 className="text-primary-300 font-semibold text-xs sm:text-sm mb-1">Transforme sua ideia em realidade!</h4>
               <p className="text-gray-300 text-xs leading-relaxed">
                 Nossa consultoria gratuita de 60 minutos vai te ajudar a validar seu projeto, 
                 definir estratégias e acelerar o desenvolvimento. <strong className="text-white">Não perca esta oportunidade </strong> 
                 de dar o próximo passo com especialistas em IA e tecnologia.
               </p>
             </div>
           </div>
         </div>

         <div className="text-center">
           <h3 className="text-sm sm:text-lg font-semibold text-white mb-1 sm:mb-2">Escolha data e horário</h3>
           <p className="text-gray-400 text-xs sm:text-sm mb-2 sm:mb-4">Selecione quando deseja agendar sua consultoria</p>
         </div>

        {/* Informações de contato */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-3">Nome *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Seu nome"
              className="w-full px-2 sm:px-3 py-0 sm:py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent text-xs sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-3">E-mail *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="voce@exemplo.com"
              className="w-full px-2 sm:px-3 py-0 sm:py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent text-xs sm:text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-3">Telefone (opcional)</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="+5511999999999"
              className="w-full px-2 sm:px-3 py-0 sm:py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* Campos lado a lado: Data e Horário */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
          {/* Campo de Data */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-3">
              <FontAwesomeIcon icon={solidIcons.faCalendar} size="sm" className="inline mr-1 sm:mr-2" />
              Data *
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-2 sm:px-3 py-0 sm:py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent date-picker-white text-xs sm:text-sm mobile-touch-target mobile-date-input"
            />
          </div>

          {/* Campo de Horário (Select) */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-3">
              <FontAwesomeIcon icon={solidIcons.faClock} size="sm" className="inline mr-1 sm:mr-2" />
              Horário *
            </label>
            <select
              required
              value={formData.time}
              onChange={(e) => handleInputChange('time', e.target.value)}
              className="w-full px-2 sm:px-3 py-0 sm:py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent text-xs sm:text-sm mobile-touch-target"
            >
              <option value="" disabled>Selecione um horário</option>
              {availableTimes.map((time) => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Resumo do Agendamento */}
        {formData.date && formData.time && (
          <div className="bg-gray-800/50 rounded-lg p-2 sm:p-4">
            <h4 className="text-xs sm:text-sm font-medium text-white mb-1 sm:mb-2">Resumo do Agendamento</h4>
            <div className="text-xs text-gray-300 space-y-0.5 sm:space-y-1">
              <div><strong>Data:</strong> {new Date(formData.date).toLocaleDateString('pt-BR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</div>
              <div><strong>Horário:</strong> {formData.time}</div>
              <div><strong>Duração:</strong> 60 minutos</div>
              <div><strong>Modalidade:</strong> Videochamada (Google Meet)</div>
            </div>
          </div>
        )}

         {/* Botões - sempre visíveis */}
         <div className="pt-2 sm:pt-4 border-t border-gray-700">
           {feedback && (
             <div className={`${feedback.type === 'success' ? 'text-emerald-400' : feedback.type === 'error' ? 'text-red-400' : 'text-gray-300'} text-xs sm:text-sm mb-2 sm:mb-3`}>
               {feedback.text}
             </div>
           )}
           <div className="flex flex-col-reverse sm:flex-row justify-end space-y-2 space-y-reverse sm:space-y-0 sm:space-x-3">
          <Button
             type="button"
             variant="outline"
             onClick={onClose}
             className="text-gray-400 border-gray-600 hover:border-gray-500 w-full sm:w-auto text-xs sm:text-sm py-1.5 sm:py-2 mobile-touch-target"
           >
             Cancelar
           </Button>
           <Button
             type="submit"
            disabled={!canSubmit || submitting}
             className="bg-primary-600 hover:bg-primary-500 text-white px-3 sm:px-6 w-full sm:w-auto text-xs sm:text-sm py-1.5 sm:py-2 mobile-touch-target"
           >
            {submitting ? 'Agendando...' : '🚀 Agendar'}
           </Button>
           </div>
         </div>
      </form>
    </Modal>
  );
};

export default SchedulingModal;