import React from 'react';
import { LanguageProvider } from './context/LanguageContext';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import HeroSection from './components/sections/HeroSection';
import TechnologiesSection from './components/sections/TechnologiesSection';
import ServicesSection from './components/sections/ServicesSection';
import CasesSection from './components/sections/CasesSection';
import AdvantagesSection from './components/sections/AdvantagesSection';
import ComparisonSection from './components/sections/ComparisonSection';
import BenefitsSection from './components/sections/BenefitsSection';
import FaqSection from './components/sections/FaqSection';
import ContactSection from './components/sections/ContactSection';

function App() {
  return (
    <LanguageProvider>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main>
          <HeroSection />
          <TechnologiesSection />
          <ServicesSection />
          <CasesSection />
          <AdvantagesSection />
          <ComparisonSection />
          <BenefitsSection />
          <FaqSection />
          <ContactSection />
        </main>
        <Footer />
      </div>
    </LanguageProvider>
  );
}

export default App;