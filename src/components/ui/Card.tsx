import React from 'react';

interface CardProps {
  className?: string;
  children: React.ReactNode;
  hover?: boolean;
}

const Card: React.FC<CardProps> = ({ className = '', children, hover = true }) => {
  return (
    <div 
      className={`bg-dark-900 rounded-xl p-6 ${hover ? 'card-hover' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

export default Card;