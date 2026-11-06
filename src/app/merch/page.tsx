'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/image';
import NextLink from 'next/link';
import { ShoppingBag, Sparkles, Check, MessageSquare } from 'lucide-react';
import { MerchCatalogService } from '@/lib/commerce/MerchCatalogService';
import { Product } from '@/types/commerce';
import { useCart } from '@/lib/commerce/CartContext';
import { UniversalDiscussionModal } from '@/components/social/UniversalDiscussionModal';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';

const CATEGORIES = ['All', 'Apparel', 'Accessories'];

export default function MerchPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCat, setSelectedCat] = useState('All');
  const [discussionProduct, setDiscussionProduct] = useState<Product | null>(null);
  const [, setCommentTick] = useState(0);
  const { addToCart } = useCart();

  const syncProducts = () => {
    setProducts(MerchCatalogService.getAllProducts());
  };

  useEffect(() => {
    syncProducts();
    const unsub = MerchCatalogService.subscribe(syncProducts);
    const unsubComments = SocialCommentService.subscribeAll(() => {
      setCommentTick((t) => t + 1);
    });
    window.addEventListener('merch-catalog-updated', syncProducts);
    return () => {
      unsub();
      unsubComments();
      window.removeEventListener('merch-catalog-updated', syncProducts);
    };
  }, []);

  const filteredProducts =
    selectedCat === 'All'
      ? products
      : products.filter((p) => p.category.toLowerCase() === selectedCat.toLowerCase());

  return (
    <div className="space-y-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-amber/20 border border-brand-amber/40 text-brand-amber text-xs font-semibold uppercase tracking-wider mb-2">
            <ShoppingBag className="w-3.5 h-3.5" />
            Official 8 of Spades Works Store
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Official Streetwear Collection</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Dark blue bomber jackets, bucket hats, snapback caps, pro basketball jerseys, backpacks, and heavyweight t-shirts.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCat === cat
                  ? 'bg-brand-gold text-black shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredProducts.map((prod) => (
          <div
            key={prod.id}
            className="glass-card p-4 rounded-3xl flex flex-col justify-between group relative overflow-hidden"
          >
            <NextLink href={`/merch/${prod.id}`} className="block">
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden mb-3 border border-white/5">
                <img
                  src={prod.images[0]}
                  alt={prod.title}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-brand-gold text-black text-[10px] font-bold uppercase">
                  {prod.category}
                </span>

                {/* Direct Comment Count Badge on Thumbnail */}
                {(() => {
                  const merchKey = buildCanonicalContentKey('merch', prod.title);
                  const count = SocialCommentService.getCommentCount(prod.id, merchKey);
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDiscussionProduct(prod);
                      }}
                      className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/75 hover:bg-black/90 backdrop-blur-md text-[10px] font-mono font-bold text-neutral-300 hover:text-brand-gold border border-white/15 hover:border-brand-gold/40 flex items-center gap-1.5 shadow-lg transition-all duration-200 z-10 cursor-pointer"
                      title={`${count} Discussion Comments & Threads on ${prod.title}`}
                    >
                      <MessageSquare className="w-3 h-3 text-brand-gold" />
                      <span>{count}</span>
                    </button>
                  );
                })()}
              </div>

              <div className="space-y-1">
                <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-brand-gold transition-colors line-clamp-2">
                  {prod.title}
                </h3>
                <p className="text-xs text-neutral-400 font-mono">By {prod.artistName}</p>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-sm font-extrabold text-brand-gold font-mono">
                    ${prod.price} {prod.currency}
                  </p>
                  {(() => {
                    const merchKey = buildCanonicalContentKey('merch', prod.title);
                    const count = SocialCommentService.getCommentCount(prod.id, merchKey);
                    return (
                      <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-brand-gold" />
                        <span>{count}</span>
                      </span>
                    );
                  })()}
                </div>
              </div>
            </NextLink>

            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => addToCart(prod)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-brand-purple text-white text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Quick Add
              </button>

              <button
                type="button"
                onClick={() => setDiscussionProduct(prod)}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-brand-gold/15 text-neutral-300 hover:text-brand-gold border border-white/10 hover:border-brand-gold/30 transition-all cursor-pointer"
                title="Open discussion threads for this product"
              >
                <MessageSquare className="w-4 h-4 text-brand-gold" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {discussionProduct && (
        <UniversalDiscussionModal
          isOpen={Boolean(discussionProduct)}
          onClose={() => setDiscussionProduct(null)}
          contentId={discussionProduct.id}
          contentKey={buildCanonicalContentKey('merch', discussionProduct.title)}
          contentType="merch"
          contentTitle={discussionProduct.title}
          contentSubtitle={`Official Syndicate Streetwear • $${discussionProduct.price} ${discussionProduct.currency}`}
          coverUrl={discussionProduct.images[0]}
          badgeLabel="Merch"
        />
      )}
    </div>
  );
}
