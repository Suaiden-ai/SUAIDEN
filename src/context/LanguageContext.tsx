import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import enTranslations from '../translations/en.json';
import ptTranslations from '../translations/pt.json';

type Language = 'en' | 'pt';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  // Try to get language from localStorage, default to 'en'
  const [language, setLanguage] = useState<Language>(() => {
    const savedLanguage = localStorage.getItem('language') as Language;
    return savedLanguage || 
           (navigator.language.startsWith('pt') ? 'pt' : 'en');
  });

  // Update localStorage when language changes
  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.lang = language;
  }, [language]);

  const translations = {
    en: enTranslations,
    pt: ptTranslations
  };

  // Translation function
  const t = (key: string): string => {
    const keys = key.split('.');
    let translation: any = translations[language];

    for (const k of keys) {
      if (!translation[k]) {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
      translation = translation[k];
    }

    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Custom hook to use the language context
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};