import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Globe } from 'lucide-react';

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="relative group">
      <button 
        className="flex items-center space-x-1 text-white/80 hover:text-white transition-colors"
        aria-label="Switch language"
      >
        <Globe size={16} />
        <span className="text-sm hidden sm:inline">{language.toUpperCase()}</span>
      </button>
      
      <div className="absolute right-0 mt-2 w-32 py-2 bg-dark-900 rounded-lg shadow-lg border border-dark-800 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <button
          onClick={() => setLanguage('en')}
          className={`block w-full text-left px-4 py-2 text-sm ${language === 'en' ? 'text-primary-400' : 'text-white/80 hover:text-white'}`}
        >
          {t('languageSwitcher.en')}
        </button>
        <button
          onClick={() => setLanguage('pt')}
          className={`block w-full text-left px-4 py-2 text-sm ${language === 'pt' ? 'text-primary-400' : 'text-white/80 hover:text-white'}`}
        >
          {t('languageSwitcher.pt')}
        </button>
      </div>
    </div>
  );
};

export default LanguageSwitcher;