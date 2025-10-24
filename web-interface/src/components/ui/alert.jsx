import React from 'react';

export const Alert = ({ 
  children, 
  variant = 'default',
  className = '',
  ...props 
}) => {
  const variantClasses = {
    default: 'bg-background text-foreground border border-border',
    destructive: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive'
  };
  
  const classes = [
    'relative w-full rounded-lg border px-4 py-3 text-sm',
    variantClasses[variant],
    className
  ].filter(Boolean).join(' ');
  
  return (
    <div className={classes} role="alert" {...props}>
      {children}
    </div>
  );
};

export const AlertDescription = ({ 
  children, 
  className = '',
  ...props 
}) => {
  return (
    <div className={`text-sm [&_p]:leading-relaxed ${className}`} {...props}>
      {children}
    </div>
  );
};