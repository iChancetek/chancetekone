'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Check,
  Plus,
} from 'lucide-react';
import { Product } from '@/types/commerce';
import { useCart } from '@/lib/commerce/CartContext';

interface MerchCarouselProps {
  products: Product[];
}

export const MerchCarousel: React.FC<MerchCarouselProps> = ({ products }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);
  const { addToCart } = useCart();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Determine items per view based on screen width (for calculating maxIndex)
  // We'll slide by 1 item smoothly
  const totalItems = products.length;

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % totalItems);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + totalItems) % totalItems);
  };

  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  useEffect(() => {
    if (isPlaying && !isHovered) {
      timerRef.current = setInterval(() => {
        nextSlide();
      }, 2000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, isHovered, totalItems]);

  const handleQuickAdd = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    const defaultVariant = product.variants[0];
    addToCart(product, defaultVariant);
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 1800);
  };

  if (!products || products.length === 0) return null;

  return (
    <section className="space-y-5">
      {/* Header with Title, Start/Stop Autoplay Toggle, and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-brand-amber/15 border border-brand-amber/30 text-brand-amber shadow-lg shadow-brand-amber/10">
            <ShoppingBag className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Official Streetwear & Merch Collection
              </h2>
              {isPlaying && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono font-bold tracking-wider uppercase animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Auto-Scrolling
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Limited 8 of Spades Works bomber jackets, bucket hats, basketball jerseys, and apparel.
            </p>
          </div>
        </div>

        {/* Action Controls: Start/Stop, Prev/Next, and Store Link */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Start / Stop Carousel Button */}
          <button
            onClick={togglePlay}
            id="merch-carousel-play-pause-btn"
            title={isPlaying ? 'Pause auto-scroll' : 'Start auto-scroll'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
              isPlaying
                ? 'bg-brand-gold/15 text-brand-gold border-brand-gold/30 hover:bg-brand-gold/25'
                : 'bg-white/10 text-neutral-300 border-white/15 hover:bg-white/20'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                <span>Start</span>
              </>
            )}
          </button>

          {/* Previous / Next Arrows */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/10">
            <button
              onClick={prevSlide}
              id="merch-carousel-prev-btn"
              title="Previous item"
              className="p-1.5 rounded-full text-neutral-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextSlide}
              id="merch-carousel-next-btn"
              title="Next item"
              className="p-1.5 rounded-full text-neutral-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Shop Store Link */}
          <Link
            href="/merch"
            className="text-xs font-semibold text-neutral-400 hover:text-brand-gold flex items-center gap-1 transition-colors pl-2"
          >
            Shop All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Carousel Track Container */}
      <div
        className="relative overflow-hidden rounded-3xl p-1"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Sliding Grid */}
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{
            transform: `translateX(-${currentIndex * (100 / Math.min(totalItems, 3))}%)`,
          }}
        >
          {/* Duplicate list to enable continuous smooth appearance */}
          {[...products, ...products].map((prod, idx) => (
            <div
              key={`${prod.id}-${idx}`}
              className="w-full sm:w-1/2 md:w-1/3 lg:w-1/4 flex-shrink-0 p-2.5"
            >
              <Link
                href={`/merch/${prod.id}`}
                className="glass-card p-4 rounded-3xl flex flex-col justify-between group block h-full relative border border-white/10 hover:border-brand-gold/40 hover:shadow-2xl hover:shadow-brand-gold/10 transition-all duration-300 bg-[#0c0c16]/80 backdrop-blur-xl"
              >
                {/* Product Image Box */}
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden mb-3.5 border border-white/5 bg-black/40">
                  <img
                    src={prod.images[0]}
                    alt={prod.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-108"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  {/* Category Pill */}
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-brand-gold text-[10px] font-bold uppercase tracking-wider">
                    {prod.category}
                  </span>

                  {/* Quick Add Button */}
                  <button
                    onClick={(e) => handleQuickAdd(e, prod)}
                    title="Quick add to bag"
                    className="absolute bottom-3 right-3 p-2.5 rounded-full bg-brand-gold text-black shadow-lg hover:scale-110 active:scale-95 transition-all opacity-90 group-hover:opacity-100"
                  >
                    {addedId === prod.id ? (
                      <Check className="w-4 h-4 text-black stroke-[3]" />
                    ) : (
                      <Plus className="w-4 h-4 text-black stroke-[3]" />
                    )}
                  </button>
                </div>

                {/* Product Details */}
                <div className="space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">
                      8 OF SPADES WORKS
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-brand-gold transition-colors line-clamp-2 mt-0.5 leading-snug">
                      {prod.title}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <p className="text-sm font-extrabold text-brand-gold font-mono">
                      ${prod.price} <span className="text-[10px] text-neutral-400 font-normal">{prod.currency}</span>
                    </p>
                    <span className="text-[11px] font-semibold text-neutral-400 group-hover:text-white flex items-center gap-1 transition-colors">
                      Details <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination Dots */}
      <div className="flex items-center justify-center gap-1.5 pt-1">
        {products.map((_, dotIndex) => (
          <button
            key={dotIndex}
            onClick={() => setCurrentIndex(dotIndex)}
            title={`Go to item ${dotIndex + 1}`}
            className={`transition-all duration-300 rounded-full ${
              currentIndex % totalItems === dotIndex
                ? 'w-6 h-2 bg-brand-gold'
                : 'w-2 h-2 bg-white/20 hover:bg-white/40'
            }`}
          />
        ))}
      </div>
    </section>
  );
};
