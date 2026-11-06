'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface AIContextType {
  isOpen: boolean;
  initialPrompt: string;
  isFloatingCollapsed: boolean;
  openAI: (prompt?: string) => void;
  closeAI: () => void;
  toggleAI: () => void;
  clearInitialPrompt: () => void;
  collapseFloatingAI: () => void;
  expandFloatingAI: () => void;
  toggleFloatingAI: () => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState('');
  const [isFloatingCollapsed, setIsFloatingCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('break_beats_ai_floating_collapsed');
      return saved !== null ? saved === 'true' : true; // Closed by default
    }
    return true;
  });

  const openAI = useCallback((prompt?: string) => {
    if (prompt) {
      setInitialPrompt(prompt);
    }
    setIsOpen(true);
  }, []);

  const closeAI = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleAI = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const clearInitialPrompt = useCallback(() => {
    setInitialPrompt('');
  }, []);

  const collapseFloatingAI = useCallback(() => {
    setIsFloatingCollapsed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('break_beats_ai_floating_collapsed', 'true');
    }
  }, []);

  const expandFloatingAI = useCallback(() => {
    setIsFloatingCollapsed(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('break_beats_ai_floating_collapsed', 'false');
    }
  }, []);

  const toggleFloatingAI = useCallback(() => {
    setIsFloatingCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('break_beats_ai_floating_collapsed', String(next));
      }
      return next;
    });
  }, []);

  return (
    <AIContext.Provider
      value={{
        isOpen,
        initialPrompt,
        isFloatingCollapsed,
        openAI,
        closeAI,
        toggleAI,
        clearInitialPrompt,
        collapseFloatingAI,
        expandFloatingAI,
        toggleFloatingAI,
      }}
    >
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
};
