import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'md' | 'lg';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Prevent scrolling when modal is open (lock page scroll robustly)
      const originalOverflow = document.body.style.overflow;
      const originalTouchAction = document.body.style.touchAction as string;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.documentElement.style.overflow = 'hidden';
      const preventScroll = (e: Event) => { 
        // Allow scrolling inside the modal
        if (modalRef.current && modalRef.current.contains(e.target as Node)) {
          return;
        }
        e.preventDefault(); 
      };
      window.addEventListener('wheel', preventScroll, { passive: false });
      window.addEventListener('touchmove', preventScroll, { passive: false });

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.body.style.overflow = originalOverflow || '';
        document.body.style.touchAction = originalTouchAction || '';
        document.documentElement.style.overflow = originalHtmlOverflow || '';
        window.removeEventListener('wheel', preventScroll as any);
        window.removeEventListener('touchmove', preventScroll as any);
      };
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on escape key press
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-dark-950/80"
          />
          
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            layout={false}
            className={`relative bg-dark-900 rounded-2xl shadow-[0_0_50px_rgba(255,255,255,0.18)] ${size === 'lg' ? 'max-w-3xl' : 'max-w-md'} w-full mx-4 min-h-[55vh] sm:min-h-[400px] max-h-[80vh] sm:max-h-[85vh] overflow-y-auto custom-scrollbar will-change-transform`}
            style={{ transform: 'translateZ(0)' }}
          >
            <div className="p-4 sm:p-6">
              {title && (
                <div className="mb-4 pb-3 sm:mb-6 sm:pb-4 border-b border-dark-700">
                  <h3 className="text-xl font-display font-medium">{title}</h3>
                </div>
              )}
              
              <button 
                onClick={onClose} 
                className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
              
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;