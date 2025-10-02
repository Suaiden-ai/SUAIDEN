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
import AnimatedGradientBackground from './components/ui/AnimatedGradientBackground';

function App() {
  return (
    <LanguageProvider>
      {/* Root layout keeps relative stacking; background is a single fixed layer for all sections */}
      <div className="relative flex flex-col min-h-screen">
        {/* Animated gradient background across the entire app */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <AnimatedGradientBackground 
            Breathing 
            startingGap={125} 
            topOffset={0}
            gradientColors={["#000000", "#000000", "#000000", "#1E0B3A", "#6D28D9", "#A78BFA", "#FFFFFF"]}
            gradientStops={[0, 30, 50, 65, 75, 85, 100]}
          />
        </div>
        <Header />
        <main className="relative z-10">
          <HeroSection />
          <ServicesSection />
          <CasesSection />
          <AdvantagesSection />
          <ComparisonSection />
          <BenefitsSection />
          <FaqSection />
          <TechnologiesSection />
        </main>
        <Footer />
      </div>
    </LanguageProvider>
  );
}

export default App;