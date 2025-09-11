
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '', title }) => {
  return (
    <div className={`bg-white rounded-xl shadow-lg overflow-hidden ${className}`}>
      {title && <h3 className="p-4 text-lg font-bold text-gray-700 border-b border-gray-100">{title}</h3>}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};

export default Card;