import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
  bodyClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-4xl',
  className = '',
  bodyClassName,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`relative z-10 w-full ${maxWidth} bg-white dark:bg-[#0c101d] border border-gray-200 dark:border-cyan-900/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
          className || 'max-h-[90vh]'
        }`}
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200 dark:border-cyan-950/60 bg-white dark:bg-[#080b14] shrink-0">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-cyan-100 tracking-wide">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-cyan-950/40 transition"
            title="Close dialog (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div className={bodyClassName || 'p-6 overflow-y-auto flex-1 min-h-0'}>{children}</div>
      </div>
    </div>
  );
};
