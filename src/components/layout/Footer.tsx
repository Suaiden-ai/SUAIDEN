import React from 'react';
import Logo from '../ui/Logo';
import { Mail, Phone, Linkedin, Instagram, Github } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const Footer: React.FC = () => {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-dark-900 mt-auto">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-4">
            <Logo />
            <p className="text-white/70 mt-4 max-w-xs">
              {t('footer.description')}
            </p>
            <div className="flex space-x-4 pt-2">
              <a 
                href="#" 
                className="text-white/60 hover:text-primary-400 transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin size={20} />
              </a>
              <a 
                href="#" 
                className="text-white/60 hover:text-primary-400 transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={20} />
              </a>
              <a 
                href="#" 
                className="text-white/60 hover:text-primary-400 transition-colors"
                aria-label="GitHub"
              >
                <Github size={20} />
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">{t('footer.quickLinks')}</h3>
            <nav className="grid grid-cols-2 gap-2">
              <a href="#" className="text-white/70 hover:text-white transition-colors">{t('footer.links.home')}</a>
              <a href="#servicos" className="text-white/70 hover:text-white transition-colors">{t('footer.links.solutions')}</a>
              <a href="#cases" className="text-white/70 hover:text-white transition-colors">{t('footer.links.cases')}</a>
              <a href="#contato" className="text-white/70 hover:text-white transition-colors">{t('footer.links.contact')}</a>
              <a href="#" className="text-white/70 hover:text-white transition-colors">{t('footer.links.privacy')}</a>
              <a href="#" className="text-white/70 hover:text-white transition-colors">{t('footer.links.terms')}</a>
            </nav>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">{t('footer.contact')}</h3>
            <div className="space-y-3">
              <a href="mailto:contato@suaiden.com" className="flex items-center text-white/70 hover:text-white transition-colors">
                <Mail size={16} className="mr-2" />
                contato@suaiden.com
              </a>
              <a href="tel:+5500000000000" className="flex items-center text-white/70 hover:text-white transition-colors">
                <Phone size={16} className="mr-2" />
                +55 00 00000-0000
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-8 text-center text-white/50">
          <p>&copy; {currentYear} SUAIDEN - Super Artificial Inteligência Desenvolvimento. {t('footer.rights')}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;