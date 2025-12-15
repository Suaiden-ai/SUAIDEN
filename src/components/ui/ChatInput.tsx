import React from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  loading?: boolean;
  placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  loading = false,
  placeholder = "Ask Suaiden..."
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="relative">
      {/* Input principal */}
      <div className="relative group">
        <style dangerouslySetInnerHTML={{__html: `
          .minimal-scrollbar::-webkit-scrollbar {
            width: 3px;
            border-radius: 999px;
          }
          .minimal-scrollbar::-webkit-scrollbar-track {
            background: transparent;
            margin-top: 12px;
            margin-bottom: 12px;
            border-radius: 999px;
          }
          .minimal-scrollbar::-webkit-scrollbar-thumb {
            background-color: rgba(113, 113, 122, 0.3);
            border-radius: 999px;
          }
          .minimal-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: rgba(113, 113, 122, 0.5);
          }
        `}} />
        <textarea
          ref={(el) => {
            if (el) {
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }
          }}
          rows={1}
          className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 pr-12 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors leading-relaxed resize-none overflow-y-auto min-h-[48px] max-h-[120px] minimal-scrollbar block"
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          style={{ height: 'auto' }}
        />
        {/* Botão de envio integrado */}
        <button
          type="button"
          onClick={onSend}
          disabled={loading || !value.trim()}
          className="absolute right-3 bottom-2 w-8 h-8 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:bg-zinc-600 disabled:opacity-50 flex items-center justify-center transition-colors shadow-lg z-10"
        >
          <Send size={14} className="text-white" />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
