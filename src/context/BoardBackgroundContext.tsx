import React, { createContext, useContext, useState } from 'react';

interface BoardBackground {
  bg_type: 'gradient' | 'image' | null;
  background: string | null;
}

interface BoardBackgroundContextType {
  boardBackground: BoardBackground;
  setBoardBackground: (bg: BoardBackground) => void;
  clearBoardBackground: () => void;
}

const BoardBackgroundContext = createContext<BoardBackgroundContextType>({
  boardBackground: { bg_type: null, background: null },
  setBoardBackground: () => {},
  clearBoardBackground: () => {},
});

export const BoardBackgroundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [boardBackground, setBoardBackgroundState] = useState<BoardBackground>({
    bg_type: null,
    background: null,
  });

  const setBoardBackground = (bg: BoardBackground) => setBoardBackgroundState(bg);
  const clearBoardBackground = () => setBoardBackgroundState({ bg_type: null, background: null });

  return (
    <BoardBackgroundContext.Provider value={{ boardBackground, setBoardBackground, clearBoardBackground }}>
      {children}
    </BoardBackgroundContext.Provider>
  );
};

export const useBoardBackground = () => useContext(BoardBackgroundContext);
