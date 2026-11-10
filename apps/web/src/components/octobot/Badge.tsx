import React from 'react';

export interface BadgeProps {
  variant?: 'cyan' | 'electric' | 'violet' | 'orange' | 'green' | 'red' | 'gray';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'cyan',
  size = 'sm',
  children,
  className = '',
}) => {
  const variantStyles = {
    cyan: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30 dark:border-cyan-800/60',
    electric: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30 dark:border-sky-800/60',
    violet: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 dark:border-indigo-800/60',
    orange: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30 dark:border-orange-800/60',
    green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 dark:border-emerald-800/60',
    red: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 dark:border-rose-800/60',
    gray: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30 dark:border-slate-700/60',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded-full border transition-all ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};
