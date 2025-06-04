import React from 'react';
import { Brain } from 'lucide-react';

const Logo: React.FC = () => {
  return (
    <a href="#" className="flex items-center space-x-2">
      <div className="bg-gradient-to-r from-primary-500 to-accent-500 p-1 rounded">
        <Brain size={24} className="text-white" />
      </div>
      <span className="font-display font-bold text-xl">SUAIDEN</span>
    </a>
  );
};

export default Logo;