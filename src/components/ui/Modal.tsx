import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useModal } from '../../context/ModalContext';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'md' | 'lg';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const { setIsModalOpen } = useModal();

  // Update modal context when modal opens/closes
  useEffect(() => {
    setIsModalOpen(isOpen);
  }, [isOpen, setIsModalOpen]);

  // Additional cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Force cleanup when modal closes
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    }
  }, [isOpen]);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      
      // Store original scroll position
      const scrollY = window.scrollY;
      
      // Lock scroll with position fixed approach
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        
        // Restore scroll
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        document.body.classList.remove('modal-open');
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
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
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center pt-8 sm:pt-0">
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
            className={`relative bg-dark-900 rounded-2xl shadow-[0_0_50px_rgba(255,255,255,0.18)] ${size === 'lg' ? 'max-w-3xl' : 'max-w-md'} w-full mx-4 max-h-[85vh] sm:max-h-[85vh] overflow-y-auto custom-scrollbar will-change-transform modal-scroll`}
            style={{ transform: 'translateZ(0)' }}
          >
            <div className="p-3 sm:p-6 pt-12 sm:pt-6 modal-content">
              {title && (
                <div className="mb-3 pb-2 sm:mb-6 sm:pb-4 border-b border-dark-700">
                  <h3 className="text-lg sm:text-xl font-display font-medium">{title}</h3>
                </div>
              )}
              
              <button 
                onClick={onClose} 
                className="absolute top-6 right-4 text-white/60 hover:text-white transition-colors z-10"
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