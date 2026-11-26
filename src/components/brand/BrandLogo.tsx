'use client';

import React from 'react';
import { useTheme } from '@/lib/theme/ThemeContext';

export const PLATFORM_NAME = 'ChanceTEK One';
export const PLATFORM_SLOGAN = 'The Algorithm of Timeless Music';
export const PLATFORM_LOGO_DARK = '/images/chancetekone_logo.png?v=2';
export const PLATFORM_LOGO_LIGHT = '/images/chancetekone_logo_light.png?v=2';
export const PLATFORM_ICON_DARK = '/images/chancetekone_icon.png?v=2';
export const PLATFORM_ICON_LIGHT = '/images/chancetekone_icon_light.png?v=2';
/** Full 16:9 dark banner reserved for OpenGraph / Twitter social preview cards */
export const PLATFORM_LOGO_SRC = '/images/chancetekone_logo.jpg?v=2';

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
    ? 'bg-gradient-to-r from-[#0284c7] via-[#7c3aed] to-[#db2777] bg-clip-text text-transparent'
    : 'bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-400 bg-clip-text text-transparent';

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
              ? 'drop-shadow-[0_2px_6px_rgba(99,102,241,0.22)]'
              : 'drop-shadow-[0_0_12px_rgba(56,189,248,0.35)]'
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
          className={`h-12 sm:h-14 w-auto object-contain object-left ${
            isLight
              ? 'drop-shadow-[0_2px_8px_rgba(15,23,42,0.08)]'
              : 'drop-shadow-[0_4px_20px_rgba(56,189,248,0.28)]'
          }`}
          draggable={false}
        />
        {showSlogan && (
          <p className={`text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.14em] pl-0.5 ${sloganClass}`}>
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
            variant === 'hero' ? 'h-14 sm:h-18' : 'h-12 sm:h-14'
          } ${
            isLight
              ? 'drop-shadow-[0_2px_10px_rgba(15,23,42,0.08)]'
              : 'drop-shadow-[0_4px_24px_rgba(56,189,248,0.28)]'
          }`}
          draggable={false}
        />
        {showSlogan && (
          <p
            className={`text-[10px] sm:text-xs font-extrabold uppercase tracking-[0.14em] text-center ${sloganClass}`}
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
          variant === 'mobile-drawer' ? 'h-11' : 'h-10'
        } max-w-[205px] ${
          isLight
            ? 'drop-shadow-[0_1px_4px_rgba(15,23,42,0.08)]'
            : 'drop-shadow-[0_2px_14px_rgba(56,189,248,0.28)]'
        }`}
        draggable={false}
      />
      {showSlogan && (
        <span
          className={`text-[9px] font-extrabold tracking-[0.08em] uppercase leading-tight pl-0.5 whitespace-nowrap ${sloganClass}`}
        >
          {PLATFORM_SLOGAN}
        </span>
      )}
    </div>
  );
};
