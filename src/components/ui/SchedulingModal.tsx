import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { solidIcons } from '../../lib/icons';

interface SchedulingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (data: SchedulingData) => void;
}

interface SchedulingData {
  date: string;
  time: string;
}

const SchedulingModal: React.FC<SchedulingModalProps> = ({ isOpen, onClose, onSchedule }) => {
  const [formData, setFormData] = useState<SchedulingData>({
    date: '',
    time: ''
  });

  const availableTimes = [
    '09:00', '10:00', '11:00', '13:00',
    '14:00', '15:00', '16:00', '17:00'
  ];

  const handleInputChange = (field: keyof SchedulingData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSchedule(formData);
    onClose();
    // Reset form
    setFormData({
      date: '',
      time: ''
    });
  };

  const canSubmit = formData.date !== '' && formData.time !== '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agendar Consultoria" size="md">
       <form onSubmit={handleSubmit} className="space-y-6">
         {/* Texto persuasivo */}
         <div className="bg-gradient-to-r from-primary-500/10 to-accent-500/10 border border-primary-500/20 rounded-lg p-4">
           <div className="flex items-start space-x-3">
             <div className="flex-shrink-0 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
               <span className="text-white text-sm font-bold">💡</span>
             </div>
             <div className="text-left">
               <h4 className="text-primary-300 font-semibold text-sm mb-1">Transforme sua ideia em realidade!</h4>
               <p className="text-gray-300 text-xs leading-relaxed">
                 Nossa consultoria gratuita de 60 minutos vai te ajudar a validar seu projeto, 
                 definir estratégias e acelerar o desenvolvimento. <strong className="text-white">Não perca esta oportunidade</strong> 
                 de dar o próximo passo com especialistas em IA e tecnologia.
               </p>
             </div>
           </div>
         </div>

         <div className="text-center">
           <h3 className="text-lg font-semibold text-white mb-2">Escolha data e horário</h3>
           <p className="text-gray-400 text-sm mb-4">Selecione quando deseja agendar sua consultoria</p>
         </div>

        {/* Campo de Data */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            <FontAwesomeIcon icon={solidIcons.faCalendar} size="sm" className="inline mr-2" />
            Data *
          </label>
          <input
            type="date"
            required
            value={formData.date}
            onChange={(e) => handleInputChange('date', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
          />
        </div>

        {/* Campo de Horário */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            <FontAwesomeIcon icon={solidIcons.faClock} size="sm" className="inline mr-2" />
            Horário *
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {availableTimes.map((time) => (
              <button
                key={time}
                type="button"
                onClick={() => handleInputChange('time', time)}
                className={`p-2 text-center border rounded-lg transition-colors text-sm ${
                  formData.time === time
                    ? 'border-primary-400 bg-primary-400/20 text-primary-400'
                    : 'border-gray-600 hover:border-primary-400 hover:bg-primary-400/10 text-white'
                }`}
              >
                {time}
              </button>
            ))}
          </div>
        </div>

        {/* Resumo do Agendamento */}
        {formData.date && formData.time && (
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-white mb-2">Resumo do Agendamento</h4>
            <div className="text-sm text-gray-300 space-y-1">
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
         <div className="flex flex-col-reverse sm:flex-row justify-end space-y-2 space-y-reverse sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-700">
           <Button
             type="button"
             variant="outline"
             onClick={onClose}
             className="text-gray-400 border-gray-600 hover:border-gray-500 w-full sm:w-auto"
           >
             Cancelar
           </Button>
           <Button
             type="submit"
             disabled={!canSubmit}
             className="bg-primary-600 hover:bg-primary-500 text-white px-6 w-full sm:w-auto"
           >
             🚀 Agendar
           </Button>
         </div>
      </form>
    </Modal>
  );
};

export default SchedulingModal;