import React from 'react';

export const Input = ({ 
  type = 'text',
  className = '',
  ...props 
}) => {
  return (
    <input
      type={type}
      className={`input ${className}`}
      {...props}
    />
  );
};