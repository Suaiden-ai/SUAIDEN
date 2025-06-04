import React, { useState, useEffect } from 'react';
import { Brain, Menu, X } from 'lucide-react';
import Logo from '../ui/Logo';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import { useLanguage } from '../../context/LanguageContext';

const Header: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header 
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? 'bg-dark-950/90 backdrop-blur-md py-3 shadow-lg' : 'bg-transparent py-5'
      }`}
    >
      <div className="container flex items-center justify-between">
        <Logo />
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          <a href="#servicos" className="text-white/80 hover:text-white transition-colors">
            {t('header.solutions')}
          </a>
          <a href="#cases" className="text-white/80 hover:text-white transition-colors">
            {t('header.cases')}
          </a>
          <a href="#vantagens" className="text-white/80 hover:text-white transition-colors">
            {t('header.whyUs')}
          </a>
          <a href="#faq" className="text-white/80 hover:text-white transition-colors">
            FAQ
          </a>
          <LanguageSwitcher />
          <a 
            href="#contato" 
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-primary-600 to-accent-600 text-white font-medium hover:shadow-[0_0_15px_rgba(154,103,255,0.5)] transition-shadow"
          >
            {t('header.contact')}
          </a>
        </nav>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center space-x-4">
          <LanguageSwitcher />
          <button 
            className="text-white p-2"
            onClick={toggleMobileMenu}
            aria-label="Menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-dark-900/95 backdrop-blur-md shadow-lg">
          <nav className="container py-5 flex flex-col space-y-4">
            <a 
              href="#servicos" 
              className="text-white/80 hover:text-white transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t('header.solutions')}
            </a>
            <a 
              href="#cases" 
              className="text-white/80 hover:text-white transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t('header.cases')}
            </a>
            <a 
              href="#vantagens" 
              className="text-white/80 hover:text-white transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t('header.whyUs')}
            </a>
            <a 
              href="#faq" 
              className="text-white/80 hover:text-white transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              FAQ
            </a>
            <a 
              href="#contato" 
              className="px-5 py-3 rounded-lg bg-gradient-to-r from-primary-600 to-accent-600 text-white font-medium text-center"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t('header.contact')}
            </a>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;