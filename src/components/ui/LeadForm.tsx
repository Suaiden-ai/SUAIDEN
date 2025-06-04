import React, { useState } from 'react';
import Button from './Button';
import Modal from './Modal';
import { ArrowRight, Brain } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface LeadFormProps {
  variant?: 'default' | 'compact';
  className?: string;
}

const LeadForm: React.FC<LeadFormProps> = ({ variant = 'default', className = '' }) => {
  const { t } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: '',
    projectDescription: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleFirstStep = (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real implementation, this would send data to your backend
    console.log('Form submitted:', formData);
    alert('Obrigado pelo seu interesse! Em breve entraremos em contato.');
    
    // Reset form
    setFormData({
      name: '',
      email: '',
      whatsapp: '',
      projectDescription: ''
    });
    setIsModalOpen(false);
  };

  return (
    <>
      <form 
        onSubmit={handleFirstStep} 
        className={`backdrop-blur-sm rounded-xl p-6 ${className}`}
      >
        <div className="space-y-4">
          <div>
            <textarea
              id="projectDescription"
              name="projectDescription"
              rows={variant === 'compact' ? 3 : 3}
              value={formData.projectDescription}
              onChange={handleChange}
              className="w-full rounded-lg bg-dark-800/80 border border-dark-700/80 text-white p-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder-white/50"
              placeholder={t('contact.placeholder')}
              required
            ></textarea>
          </div>
          
          <Button 
            type="submit" 
            size="lg" 
            className="w-full group"
          >
            {t('contact.button')}
            <ArrowRight size={16} className="ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
          
          <p className="text-white/60 text-sm text-center">
            {t('contact.privacy')}
          </p>
        </div>
      </form>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={t('contact.modal.title')}
      >
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center">
            <Brain size={28} className="text-white" />
          </div>
          <p className="text-center text-white/80 text-sm">
            {t('contact.modal.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-white/80 mb-1 text-sm">
              {t('contact.modal.name')}
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full rounded-lg bg-dark-800 border border-dark-700 text-white p-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={t('contact.modal.name')}
              required
            />
          </div>
          
          <div>
            <label htmlFor="email" className="block text-white/80 mb-1 text-sm">
              {t('contact.modal.email')}
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full rounded-lg bg-dark-800 border border-dark-700 text-white p-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={t('contact.modal.email')}
              required
            />
          </div>
          
          <div>
            <label htmlFor="whatsapp" className="block text-white/80 mb-1 text-sm">
              {t('contact.modal.whatsapp')}
            </label>
            <input
              type="tel"
              id="whatsapp"
              name="whatsapp"
              value={formData.whatsapp}
              onChange={handleChange}
              className="w-full rounded-lg bg-dark-800 border border-dark-700 text-white p-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={t('contact.modal.whatsapp')}
              required
            />
          </div>
          
          <Button 
            type="submit" 
            size="lg" 
            className="w-full mt-4 group"
          >
            {t('contact.modal.button')}
            <ArrowRight size={16} className="ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
          
          <p className="text-center text-white/60 text-xs mt-2">
            {t('contact.modal.privacy')}
          </p>
        </form>
      </Modal>
    </>
  );
};

export default LeadForm;