'use client';

// ============================================================
// Radio Context — React bridge for the RadioOrchestrator
// ============================================================

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { RadioOrchestratorState, RadioStationId } from '@/types/radio';
import { radioOrchestrator } from './RadioOrchestrator';

interface RadioContextValue {
  state: RadioOrchestratorState;
  activeStation: RadioStationId | null;
  tuneIn: (stationId: RadioStationId) => void;
  tuneOut: (stationId: RadioStationId) => void;
  skip: (stationId: RadioStationId) => void;
  setVolume: (stationId: RadioStationId, volume: number) => void;
  pause: (stationId: RadioStationId) => void;
  resume: (stationId: RadioStationId) => void;
}

const RadioContext = createContext<RadioContextValue | null>(null);

export function RadioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RadioOrchestratorState>(() =>
    radioOrchestrator.getState()
  );

  useEffect(() => {
    // Initialize orchestrator on mount
    radioOrchestrator.initialize();

    // Subscribe to state changes
    const unsubscribe = radioOrchestrator.subscribe((newState) => {
      setState(newState);
    });

    return () => {
      unsubscribe();
      // Stop all broadcast on unmount
      const current = radioOrchestrator.getActiveStation();
      if (current) radioOrchestrator.tuneOut(current);
    };
  }, []);

  const tuneIn = useCallback((stationId: RadioStationId) => {
    radioOrchestrator.tuneIn(stationId);
  }, []);

  const tuneOut = useCallback((stationId: RadioStationId) => {
    radioOrchestrator.tuneOut(stationId);
  }, []);

  const skip = useCallback((stationId: RadioStationId) => {
    radioOrchestrator.skip(stationId);
  }, []);

  const setVolume = useCallback((stationId: RadioStationId, volume: number) => {
    radioOrchestrator.setVolume(stationId, volume);
  }, []);

  const pause = useCallback((stationId: RadioStationId) => {
    radioOrchestrator.pause(stationId);
  }, []);

  const resume = useCallback((stationId: RadioStationId) => {
    radioOrchestrator.resume(stationId);
  }, []);

  return (
    <RadioContext.Provider
      value={{
        state,
        activeStation: radioOrchestrator.getActiveStation(),
        tuneIn,
        tuneOut,
        skip,
        setVolume,
        pause,
        resume,
      }}
    >
      {children}
    </RadioContext.Provider>
  );
}

export function useRadio(): RadioContextValue {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error('useRadio must be used inside <RadioProvider>');
  return ctx;
}
