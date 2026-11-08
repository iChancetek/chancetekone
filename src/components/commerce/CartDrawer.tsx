'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useCart } from '@/lib/commerce/CartContext';

export const CartDrawer: React.FC = () => {
  const {
    items,
    isOpen,
    closeCart,
    updateQuantity,
    removeFromCart,
    subtotal,
    shipping,
    tax,
    total,
    clearCart,
  } = useCart();

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);

  if (!isOpen) return null;

  const handleMockCheckout = () => {
    setIsCheckingOut(true);
    setTimeout(() => {
      setIsCheckingOut(false);
      setOrderComplete(true);
      clearCart();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={closeCart}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer Panel */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md glass-panel border-l border-white/10 p-6 flex flex-col justify-between shadow-2xl bg-[#0c0c16]/95 animate-in slide-in-from-right duration-300">
          {/* Top Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-brand-gold" />
              <h2 className="text-base font-bold text-white">ChanceTEK One Merch Cart</h2>
            </div>
            <button
              onClick={closeCart}
              className="p-1.5 rounded-full text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Content */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {orderComplete ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center mx-auto text-green-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white">Order Confirmed!</h3>
                <p className="text-xs text-neutral-300">
                  Thank you for supporting breakbeat vinyl and artists. Your mock order has been recorded.
                </p>
                <button
                  onClick={() => setOrderComplete(false)}
                  className="mt-4 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
                >
                  Continue Browsing
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <ShoppingBag className="w-12 h-12 text-neutral-500 mx-auto" />
                <p className="text-sm font-semibold text-neutral-300">Your cart is empty</p>
                <p className="text-xs text-neutral-500">
                  Browse official hoodies, limited purple vinyl, snapback caps, and silk posters.
                </p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 p-3 rounded-2xl bg-white/5 border border-white/5"
                >
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                    <Image
                      src={item.product.images[0]}
                      alt={item.product.title}
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white truncate">{item.product.title}</h4>
                      {item.variantName && (
                        <p className="text-[11px] text-neutral-400">{item.variantName}</p>
                      )}
                      <p className="text-xs text-brand-gold font-mono font-semibold mt-0.5">
                        ${item.price} {item.product.currency}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2 bg-white/10 px-2 py-0.5 rounded-lg">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="text-neutral-400 hover:text-white"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-semibold text-white px-1">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="text-neutral-400 hover:text-white"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-neutral-500 hover:text-red-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bottom Summary & Checkout */}
          {items.length > 0 && !orderComplete && (
            <div className="border-t border-white/10 pt-4 space-y-3">
              <div className="space-y-1.5 text-xs text-neutral-300">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono text-white">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Shipping</span>
                  <span className="font-mono text-white">
                    {shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Tax</span>
                  <span className="font-mono text-white">${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white border-t border-white/10 pt-2">
                  <span>Total</span>
                  <span className="font-mono text-brand-gold">${total.toFixed(2)} USD</span>
                </div>
              </div>

              <button
                onClick={handleMockCheckout}
                disabled={isCheckingOut}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-brand-gold via-brand-amber to-brand-neon text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] transition-transform disabled:opacity-50"
              >
                {isCheckingOut ? (
                  'Processing Secure Checkout...'
                ) : (
                  <>
                    Proceed to Checkout
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
