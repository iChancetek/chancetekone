'use client';

import React from 'react';
import { useTheme } from '@/lib/theme/ThemeContext';

export const PLATFORM_NAME = 'ChanceTEK One';
export const PLATFORM_SLOGAN = 'Listen. Watch. Discover.';
export const PLATFORM_LOGO_DARK = '/images/chancetekone_logo.png';
export const PLATFORM_LOGO_LIGHT = '/images/chancetekone_logo_light.png';
export const PLATFORM_ICON_DARK = '/images/chancetekone_icon.png';
export const PLATFORM_ICON_LIGHT = '/images/chancetekone_icon_light.png';
/** Full 16:9 dark banner reserved for OpenGraph / Twitter social preview cards */
export const PLATFORM_LOGO_SRC = '/images/chancetekone_logo.jpg';

export type BrandLogoVariant = 'sidebar' | 'compact' | 'mobile-drawer' | 'footer' | 'hero' | 'auth';

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  showSlogan?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'sidebar',
  showSlogan = true,
  className = '',
}) => {
  const { isLight } = useTheme();
  const wordmarkSrc = isLight ? PLATFORM_LOGO_LIGHT : PLATFORM_LOGO_DARK;
  const iconSrc = isLight ? PLATFORM_ICON_LIGHT : PLATFORM_ICON_DARK;

  const sloganClass = isLight
    ? 'bg-gradient-to-r from-[#b87300] via-[#7b2cbf] to-[#d60017] bg-clip-text text-transparent'
    : 'bg-gradient-to-r from-brand-gold via-amber-200 to-brand-neon bg-clip-text text-transparent';

  // Seamless transparent C-Play emblem (zero box, zero border, zero sticker frame)
  if (variant === 'compact') {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 select-none ${className}`}
        title={`${PLATFORM_NAME} — ${PLATFORM_SLOGAN}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconSrc}
          alt={PLATFORM_NAME}
          className={`w-9 h-9 object-contain transition-transform duration-200 ${
            isLight
              ? 'drop-shadow-[0_2px_6px_rgba(123,44,191,0.18)]'
              : 'drop-shadow-[0_0_12px_rgba(245,195,68,0.28)]'
          }`}
          draggable={false}
        />
      </span>
    );
  }

  // Global Footer — floating transparent wordmark + slogan integrated directly on glass surface
  if (variant === 'footer') {
    return (
      <div className={`inline-flex flex-col items-start gap-2 select-none ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={wordmarkSrc}
          alt={`${PLATFORM_NAME} — ${PLATFORM_SLOGAN}`}
          className={`h-11 sm:h-12 w-auto object-contain object-left ${
            isLight
              ? 'drop-shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
              : 'drop-shadow-[0_4px_20px_rgba(157,78,221,0.28)]'
          }`}
          draggable={false}
        />
        {showSlogan && (
          <p className={`text-xs sm:text-sm font-extrabold uppercase tracking-[0.2em] pl-0.5 ${sloganClass}`}>
            {PLATFORM_SLOGAN}
          </p>
        )}
      </div>
    );
  }

  // Hero / Auth Modal / Sign-Up / Shared Link — centered transparent lockup
  if (variant === 'hero' || variant === 'auth') {
    return (
      <div className={`inline-flex flex-col items-center gap-2 select-none ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={wordmarkSrc}
          alt={`${PLATFORM_NAME} — ${PLATFORM_SLOGAN}`}
          className={`w-auto object-contain ${
            variant === 'hero' ? 'h-12 sm:h-16' : 'h-10 sm:h-12'
          } ${
            isLight
              ? 'drop-shadow-[0_2px_10px_rgba(0,0,0,0.08)]'
              : 'drop-shadow-[0_4px_24px_rgba(245,195,68,0.22)]'
          }`}
          draggable={false}
        />
        {showSlogan && (
          <p
            className={`text-[10px] sm:text-xs font-extrabold uppercase tracking-[0.22em] text-center ${sloganClass}`}
          >
            {PLATFORM_SLOGAN}
          </p>
        )}
      </div>
    );
  }

  // 'sidebar' | 'mobile-drawer' — sleek native navigation header wordmark (zero sticker box)
  return (
    <div className={`flex flex-col items-start gap-1 min-w-0 select-none ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={wordmarkSrc}
        alt={`${PLATFORM_NAME} — ${PLATFORM_SLOGAN}`}
        className={`w-auto object-contain object-left ${
          variant === 'mobile-drawer' ? 'h-10' : 'h-9'
        } max-w-[185px] ${
          isLight
            ? 'drop-shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
            : 'drop-shadow-[0_2px_14px_rgba(157,78,221,0.28)]'
        }`}
        draggable={false}
      />
      {showSlogan && (
        <span
          className={`text-[10px] font-extrabold tracking-[0.18em] uppercase leading-tight pl-0.5 truncate ${sloganClass}`}
        >
          {PLATFORM_SLOGAN}
        </span>
      )}
    </div>
  );
};
