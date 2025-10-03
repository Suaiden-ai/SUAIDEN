import React from 'react';

const Logo: React.FC = () => {
  return (
    <a href="#" className="flex items-center space-x-3">
      <img 
        src="/Logo_Suaiden.png" 
        alt="Suaiden Logo" 
        className="h-10 w-auto"
      />
      <span className="font-display font-bold text-xl text-white">SU AI DEN</span>
    </a>
  );
};

export default Logo;