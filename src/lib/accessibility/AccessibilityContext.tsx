'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type FontSizePreset = 'sm' | 'base' | 'lg' | 'xl' | '2xl';
export type LineSpacingPreset = 'normal' | 'relaxed' | 'loose';

export interface FontSizeOption {
  preset: FontSizePreset;
  scale: number; // Percentage, e.g. 100
  label: string;
  sublabel: string;
  pxEquivalent: string;
}

export const FONT_SIZE_OPTIONS: FontSizeOption[] = [
  { preset: 'sm', scale: 90, label: 'Compact', sublabel: '90%', pxEquivalent: '14.4px' },
  { preset: 'base', scale: 100, label: 'Standard', sublabel: '100% (Default)', pxEquivalent: '16px' },
  { preset: 'lg', scale: 115, label: 'Large', sublabel: '115%', pxEquivalent: '18.4px' },
  { preset: 'xl', scale: 130, label: 'Extra Large', sublabel: '130%', pxEquivalent: '20.8px' },
  { preset: '2xl', scale: 145, label: 'Maximum', sublabel: '145%', pxEquivalent: '23.2px' },
];

interface AccessibilityContextType {
  fontScale: number;
  currentPreset: FontSizePreset;
  highContrast: boolean;
  lineSpacing: LineSpacingPreset;
  isModalOpen: boolean;
  setFontScale: (scale: number) => void;
  setPreset: (preset: FontSizePreset) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  toggleHighContrast: () => void;
  setLineSpacing: (spacing: LineSpacingPreset) => void;
  resetToDefault: () => void;
  openModal: () => void;
  closeModal: () => void;
  toggleModal: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

const STORAGE_KEY_SCALE = 'breakbeats_font_scale';
const STORAGE_KEY_CONTRAST = 'breakbeats_high_contrast';
const STORAGE_KEY_SPACING = 'breakbeats_line_spacing';

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fontScale, setFontScaleState] = useState<number>(100);
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [lineSpacing, setLineSpacingState] = useState<LineSpacingPreset>('normal');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  // Apply scales to DOM
  const applySettingsToDOM = useCallback((scale: number, contrast: boolean, spacing: LineSpacingPreset) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    // Apply root font-size percentage
    root.style.fontSize = `${scale}%`;

    // Apply data attributes
    const matchingOption = FONT_SIZE_OPTIONS.find((opt) => opt.scale === scale) || FONT_SIZE_OPTIONS[1];
    root.setAttribute('data-font-scale', matchingOption.preset);

    // Apply High Contrast class
    if (contrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Apply Line Spacing classes
    root.classList.remove('relaxed-spacing', 'loose-spacing');
    if (spacing === 'relaxed') root.classList.add('relaxed-spacing');
    if (spacing === 'loose') root.classList.add('loose-spacing');
  }, []);

  // Hydrate from localStorage on client mount
  useEffect(() => {
    try {
      const savedScale = localStorage.getItem(STORAGE_KEY_SCALE);
      const savedContrast = localStorage.getItem(STORAGE_KEY_CONTRAST);
      const savedSpacing = localStorage.getItem(STORAGE_KEY_SPACING) as LineSpacingPreset | null;

      const scale = savedScale ? parseInt(savedScale, 10) || 100 : 100;
      const contrast = savedContrast === 'true';
      const spacing = savedSpacing || 'normal';

      setFontScaleState(scale);
      setHighContrast(contrast);
      setLineSpacingState(spacing);
      applySettingsToDOM(scale, contrast, spacing);
    } catch (e) {
      console.warn('Could not read accessibility settings from localStorage', e);
    }
    setMounted(true);
  }, [applySettingsToDOM]);

  const setFontScale = useCallback(
    (newScale: number) => {
      const clamped = Math.min(160, Math.max(85, newScale));
      setFontScaleState(clamped);
      applySettingsToDOM(clamped, highContrast, lineSpacing);
      try {
        localStorage.setItem(STORAGE_KEY_SCALE, clamped.toString());
      } catch (e) {}
    },
    [highContrast, lineSpacing, applySettingsToDOM]
  );

  const setPreset = useCallback(
    (preset: FontSizePreset) => {
      const target = FONT_SIZE_OPTIONS.find((opt) => opt.preset === preset) || FONT_SIZE_OPTIONS[1];
      setFontScale(target.scale);
    },
    [setFontScale]
  );

  const increaseFontSize = useCallback(() => {
    const currentIndex = FONT_SIZE_OPTIONS.findIndex((opt) => opt.scale >= fontScale);
    if (currentIndex < FONT_SIZE_OPTIONS.length - 1 && currentIndex !== -1) {
      setFontScale(FONT_SIZE_OPTIONS[currentIndex + 1].scale);
    } else if (currentIndex === -1) {
      setFontScale(115);
    }
  }, [fontScale, setFontScale]);

  const decreaseFontSize = useCallback(() => {
    const currentIndex = FONT_SIZE_OPTIONS.findIndex((opt) => opt.scale >= fontScale);
    if (currentIndex > 0) {
      setFontScale(FONT_SIZE_OPTIONS[currentIndex - 1].scale);
    } else if (currentIndex === -1) {
      setFontScale(100);
    }
  }, [fontScale, setFontScale]);

  const toggleHighContrast = useCallback(() => {
    const nextVal = !highContrast;
    setHighContrast(nextVal);
    applySettingsToDOM(fontScale, nextVal, lineSpacing);
    try {
      localStorage.setItem(STORAGE_KEY_CONTRAST, nextVal.toString());
    } catch (e) {}
  }, [highContrast, fontScale, lineSpacing, applySettingsToDOM]);

  const setLineSpacing = useCallback(
    (spacing: LineSpacingPreset) => {
      setLineSpacingState(spacing);
      applySettingsToDOM(fontScale, highContrast, spacing);
      try {
        localStorage.setItem(STORAGE_KEY_SPACING, spacing);
      } catch (e) {}
    },
    [fontScale, highContrast, applySettingsToDOM]
  );

  const resetToDefault = useCallback(() => {
    setFontScaleState(100);
    setHighContrast(false);
    setLineSpacingState('normal');
    applySettingsToDOM(100, false, 'normal');
    try {
      localStorage.removeItem(STORAGE_KEY_SCALE);
      localStorage.removeItem(STORAGE_KEY_CONTRAST);
      localStorage.removeItem(STORAGE_KEY_SPACING);
    } catch (e) {}
  }, [applySettingsToDOM]);

  const currentPreset: FontSizePreset =
    FONT_SIZE_OPTIONS.find((opt) => opt.scale === fontScale)?.preset ||
    (fontScale > 135 ? '2xl' : fontScale > 120 ? 'xl' : fontScale > 105 ? 'lg' : fontScale < 95 ? 'sm' : 'base');

  return (
    <AccessibilityContext.Provider
      value={{
        fontScale,
        currentPreset,
        highContrast,
        lineSpacing,
        isModalOpen,
        setFontScale,
        setPreset,
        increaseFontSize,
        decreaseFontSize,
        toggleHighContrast,
        setLineSpacing,
        resetToDefault,
        openModal: () => setIsModalOpen(true),
        closeModal: () => setIsModalOpen(false),
        toggleModal: () => setIsModalOpen((prev) => !prev),
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};
