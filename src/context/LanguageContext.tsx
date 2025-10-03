import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import enTranslations from '../translations/en.json';
import ptTranslations from '../translations/pt.json';

type Language = 'en' | 'pt';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, options?: { returnObjects?: boolean }) => string | any;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  // Try to get language from localStorage, default to 'en'
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const savedLanguage = localStorage.getItem('language') as Language;
      if (savedLanguage && (savedLanguage === 'pt' || savedLanguage === 'en')) {
        console.log('🌐 LanguageProvider initialized with saved language:', savedLanguage);
        return savedLanguage;
      }
    } catch (error) {
      console.warn('Failed to read language from localStorage:', error);
    }
    
    const detectedLanguage = navigator.language.startsWith('pt') ? 'pt' : 'en';
    console.log('🌐 LanguageProvider initialized with detected language:', detectedLanguage, 'from navigator:', navigator.language);
    return detectedLanguage;
  });

  // Update localStorage when language changes
  useEffect(() => {
    console.log('🌐 Language changed to:', language);
    localStorage.setItem('language', language);
    document.documentElement.lang = language;
  }, [language]);

  const translations = {
    en: enTranslations,
    pt: ptTranslations
  };

  // Translation function
  const t = (key: string, options?: { returnObjects?: boolean }): string | any => {
    const keys = key.split('.');
    let translation: any = translations[language];

    for (const k of keys) {
      if (!translation[k]) {
        console.warn(`Translation key not found: ${key} for language: ${language}`);
        return key;
      }
      translation = translation[k];
    }

    if (options?.returnObjects) {
      return translation;
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