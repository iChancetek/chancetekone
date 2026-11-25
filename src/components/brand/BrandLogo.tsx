'use client';

import React from 'react';
import Image from 'next/image';

export const PLATFORM_NAME = 'ChanceTEK One';
export const PLATFORM_SLOGAN = 'Listen. Watch. Discover.';
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
  if (variant === 'compact') {
    return (
      <div
        className={`relative w-11 h-11 rounded-xl overflow-hidden bg-[#050509] border border-brand-gold/30 shadow-[0_0_16px_rgba(245,195,68,0.2)] flex items-center justify-center shrink-0 ${className}`}
        title={`${PLATFORM_NAME} — ${PLATFORM_SLOGAN}`}
      >
        <Image
          src={PLATFORM_LOGO_SRC}
          alt={PLATFORM_NAME}
          width={88}
          height={50}
          className="w-full h-full object-cover scale-125"
          priority
        />
      </div>
    );
  }

  if (variant === 'footer') {
    return (
      <div className={`inline-flex flex-col gap-2 ${className}`}>
        <div className="relative w-52 sm:w-60 aspect-[16/9] rounded-2xl overflow-hidden bg-[#050509] border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.65)]">
          <Image
            src={PLATFORM_LOGO_SRC}
            alt={PLATFORM_NAME}
            fill
            sizes="240px"
            className="object-cover"
          />
        </div>
        {showSlogan && (
          <p className="text-xs sm:text-sm font-bold tracking-wide bg-gradient-to-r from-brand-gold via-amber-300 to-brand-neon bg-clip-text text-transparent">
            {PLATFORM_SLOGAN}
          </p>
        )}
      </div>
    );
  }

  if (variant === 'hero' || variant === 'auth') {
    return (
      <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
        <div
          className={`relative overflow-hidden bg-[#050509] border border-brand-gold/25 shadow-[0_12px_36px_rgba(0,0,0,0.7)] ${variant === 'hero'
              ? 'w-56 sm:w-72 aspect-[16/9] rounded-2xl'
              : 'w-44 sm:w-52 aspect-[16/9] rounded-2xl'
            }`}
        >
          <Image
            src={PLATFORM_LOGO_SRC}
            alt={PLATFORM_NAME}
            fill
            sizes={variant === 'hero' ? '288px' : '208px'}
            className="object-cover"
            priority
          />
        </div>
        {showSlogan && (
          <p className="text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.18em] bg-gradient-to-r from-brand-gold via-amber-200 to-brand-neon bg-clip-text text-transparent text-center">
            {PLATFORM_SLOGAN}
          </p>
        )}
      </div>
    );
  }

  // 'sidebar' | 'mobile-drawer'
  return (
    <div className={`flex flex-col gap-1 min-w-0 ${className}`}>
      <div
        className={`relative overflow-hidden bg-[#050509] border border-white/10 shadow-[0_4px_18px_rgba(0,0,0,0.55)] ${variant === 'mobile-drawer'
            ? 'w-44 aspect-[16/9] rounded-xl'
            : 'w-44 aspect-[16/9] rounded-xl'
          }`}
      >
        <Image
          src={PLATFORM_LOGO_SRC}
          alt={PLATFORM_NAME}
          fill
          sizes="180px"
          className="object-cover"
          priority
        />
      </div>
      {showSlogan && (
        <span className="text-[10px] font-bold tracking-wider uppercase bg-gradient-to-r from-brand-gold via-amber-300 to-brand-neon bg-clip-text text-transparent leading-tight pl-0.5 truncate">
          {PLATFORM_SLOGAN}
        </span>
      )}
    </div>
  );
};

