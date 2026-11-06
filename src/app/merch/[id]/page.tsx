'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, Star, ShieldCheck, Truck, ArrowRight, Check, MessageSquare, Share2 } from 'lucide-react';
import { MerchCatalogService } from '@/lib/commerce/MerchCatalogService';
import { useCart } from '@/lib/commerce/CartContext';
import { ProductVariant } from '@/types/commerce';
import { CommentSection } from '@/components/comments/CommentSection';
import { UniversalShareModal } from '@/components/social/UniversalShareModal';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;
  const { addToCart, openCart } = useCart();

  const product = MerchCatalogService.getProductById(productId) || MerchCatalogService.getAllProducts()[0];
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(
    product.variants[0] || { id: 'std', name: 'Standard', sku: 'STD', price: product.price, inStock: true }
  );
  const [selectedImage, setSelectedImage] = useState(product.images[0]);
  const [added, setAdded] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const handleAdd = () => {
    addToCart(product, selectedVariant);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    addToCart(product, selectedVariant);
    openCart();
  };

  return (
    <div className="space-y-10 py-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start">
        {/* Left: Gallery */}
        <div className="space-y-4">
          <div className="relative aspect-square w-full rounded-3xl overflow-hidden glass-panel border border-white/10 shadow-2xl">
            <img
              src={selectedImage}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          </div>

          {product.images.length > 1 && (
            <div className="flex gap-3">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(img)}
                  className={`relative w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all ${
                    selectedImage === img ? 'border-brand-gold scale-105' : 'border-white/10 opacity-70'
                  }`}
                >
                  <img src={img} alt="Thumbnail" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Info & Purchase Controls */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-6 bg-white/5 shadow-2xl">
          <div className="space-y-2">
            <span className="px-2.5 py-1 rounded-md bg-brand-gold/20 text-brand-gold text-[10px] font-bold uppercase tracking-wider">
              {product.category}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{product.title}</h1>
            {product.artistName && (
              <p className="text-xs text-neutral-400">
                Official release by{' '}
                <span className="text-brand-neon font-semibold">{product.artistName}</span>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-brand-gold">
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 fill-current" />
                <span className="font-bold">{product.rating}</span>
                <span className="text-neutral-500">({product.reviewCount} customer reviews)</span>
              </div>
              <span>•</span>
              {(() => {
                const merchKey = buildCanonicalContentKey('merch', product.title);
                const count = SocialCommentService.getCommentCount(product.id, merchKey);
                return (
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('merch-comments-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/30 text-neutral-300 hover:text-brand-gold text-xs font-bold transition-all cursor-pointer"
                    title={`${count} Discussion Threads`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-brand-gold" />
                    <span className="font-mono text-brand-gold font-bold">{count}</span>
                    <span>Threads</span>
                  </button>
                );
              })()}
            </div>
          </div>

          {/* Price */}
          <div className="border-t border-b border-white/10 py-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-brand-gold font-mono">
              ${selectedVariant.price || product.price}
            </span>
            <span className="text-xs text-neutral-400">{product.currency}</span>
          </div>

          {/* Variants / Size Picker */}
          {product.variants.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Select Option / Size:
              </label>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      selectedVariant.id === v.id
                        ? 'bg-brand-purple text-white border-brand-purple shadow-md scale-105'
                        : 'bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleAdd}
              className="w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider border border-white/15 transition-all flex items-center justify-center gap-2"
            >
              {added ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  Added to Cart!
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  Add to Cart
                </>
              )}
            </button>

            <button
              onClick={handleBuyNow}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-gold via-brand-amber to-brand-neon text-black font-extrabold text-xs uppercase tracking-wider shadow-xl hover:scale-[1.02] transition-transform"
            >
              Buy Now with 1-Click
            </button>

            <button
              onClick={() => setShowShareModal(true)}
              className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-brand-gold/40 text-neutral-300 hover:text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              title="Share Merch & Text Message"
            >
              <Share2 className="w-4 h-4 text-brand-gold" />
              <span>Share Merchandise</span>
            </button>
          </div>

          {/* Security & Shipping badges */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5 text-[11px] text-neutral-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-gold" />
              <span>Authentic Syndicate Merch</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-brand-neon" />
              <span>Worldwide Tracked Shipping</span>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-white/5 space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-brand-gold">
          Product Details & Fabric Specifications
        </h3>
        <p className="text-sm text-neutral-300 leading-relaxed">{product.description}</p>
      </div>

      {/* Community Reviews & Discussion Threads */}
      <div id="merch-comments-section" className="pt-2">
        <CommentSection
          contentId={product.id}
          contentKey={buildCanonicalContentKey('merch', product.title)}
          contentType="merch"
          contentTitle={product.title}
        />
      </div>

      {showShareModal && (
        <UniversalShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          entity={{
            type: 'merch',
            item: product,
          }}
        />
      )}
    </div>
  );
}
