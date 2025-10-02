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
      <div className="relative">
        <input
          className="w-full rounded-xl bg-dark-800 border border-dark-700 px-4 py-3 pr-12 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors leading-relaxed"
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        {/* Botão de envio integrado */}
        <button
          type="button"
          onClick={onSend}
          disabled={loading || !value.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:bg-dark-600 disabled:opacity-50 flex items-center justify-center transition-colors"
        >
          <Send size={14} className="text-white" />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
