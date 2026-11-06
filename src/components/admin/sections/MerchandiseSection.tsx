'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { MerchAnalyticsRecord, FunnelStage } from '@/types/analytics';
import { Product } from '@/types/commerce';
import { MerchCatalogService } from '@/lib/commerce/MerchCatalogService';
import { useAuth } from '@/lib/auth/AuthContext';
import { ConversionFunnelChart } from '../charts/ConversionFunnelChart';
import { BarRankingChart, RankingItem } from '../charts/BarRankingChart';
import {
  ConfirmDeletionModal,
  DeletableItem,
} from '../modals/ConfirmDeletionModal';
import {
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Package,
  CheckCircle2,
  Trash2,
  Search,
  Sliders,
  Eye,
  ShoppingCart,
} from 'lucide-react';

interface MerchandiseSectionProps {
  products: MerchAnalyticsRecord[];
  funnelStages: FunnelStage[];
}

export const MerchandiseSection: React.FC<MerchandiseSectionProps> = ({
  products: initialAnalyticsProducts,
  funnelStages,
}) => {
  const { profile } = useAuth();
  const [subTab, setSubTab] = useState<'catalog' | 'analytics'>('catalog');

  // Live products
  const [liveProducts, setLiveProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Deletion modal
  const [itemToDelete, setItemToDelete] = useState<DeletableItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const syncProducts = () => {
    setLiveProducts(MerchCatalogService.getAllProducts());
  };

  useEffect(() => {
    syncProducts();
    const unsub = MerchCatalogService.subscribe(syncProducts);
    window.addEventListener('merch-catalog-updated', syncProducts);
    return () => {
      unsub();
      window.removeEventListener('merch-catalog-updated', syncProducts);
    };
  }, []);

  const handleConfirmDeletion = (reason: string) => {
    if (!itemToDelete) return;
    setIsDeleting(true);

    const adminActor = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || profile?.email || 'Platform Administrator',
      email: profile?.email || 'admin@8ofspadesworks.com',
      role: 'admin',
    };

    try {
      MerchCatalogService.removeProduct(itemToDelete.id, adminActor, reason);
      setFeedbackMessage(`Product "${itemToDelete.title}" deleted from live store catalog.`);
      syncProducts();
      setItemToDelete(null);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (e) {
      console.error('Error deleting product:', e);
      setFeedbackMessage('Failed to delete product.');
    } finally {
      setIsDeleting(false);
    }
  };

  const categories = ['all', ...Array.from(new Set(liveProducts.map((p) => p.category)))];

  const filteredLiveProducts = liveProducts.filter((p) => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    );
  });

  // Filter analytics products to only active live products
  const activeIds = new Set(liveProducts.map((p) => p.id));
  const activeAnalyticsProducts = initialAnalyticsProducts.filter((p) => activeIds.has(p.id));

  const topRevenueRankingItems: RankingItem[] = [...activeAnalyticsProducts]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((p, idx) => ({
      id: p.id,
      rank: idx + 1,
      title: p.title,
      subtitle: `${p.category} • $${p.price.toFixed(2)}`,
      coverUrl: p.images[0],
      value: p.revenue,
      displayValue: `$${p.revenue.toLocaleString()}`,
      trendPercent: p.trendPercent,
      secondaryMetric: `${p.purchases} units sold`,
    }));

  const totalRevenue = activeAnalyticsProducts.reduce((sum, p) => sum + p.revenue, 0);
  const totalPurchases = activeAnalyticsProducts.reduce((sum, p) => sum + p.purchases, 0);
  const avgOrderValue = totalPurchases > 0 ? (totalRevenue / totalPurchases).toFixed(2) : '0.00';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Feedback Toast */}
      {feedbackMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-between shadow-2xl animate-in slide-in-from-top-4">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-xs sm:text-sm font-bold">{feedbackMessage}</p>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-xs uppercase font-mono font-bold text-emerald-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Subtab Navigation Pills */}
      <div className="p-2 rounded-2xl glass-panel border border-white/5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSubTab('catalog')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'catalog'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-neutral-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Live Merchandise SKUs</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
              {liveProducts.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'analytics'
                ? 'bg-brand-gold text-black shadow-lg shadow-brand-gold/20'
                : 'text-neutral-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Store Funnel & Performance</span>
          </button>
        </div>

        <div className="text-[11px] text-neutral-400 font-mono pr-2">
          Merchandise Deletion Authority • Recorded in Audit Trail
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. LIVE STORE CATALOG & DELETION                                          */}
      {/* ========================================================================= */}
      {subTab === 'catalog' && (
        <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-400" />
                Live Merchandise SKUs & Deletion Console
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Manage physical vinyl releases, streetwear apparel, accessories, and collectibles on the platform.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search live SKU, name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="p-2 rounded-xl bg-[#141224] border border-white/10 text-white text-xs uppercase font-bold focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredLiveProducts.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-2xl glass-panel border border-white/10 bg-white/5 hover:border-emerald-500/40 transition-all flex flex-col justify-between space-y-3 group"
              >
                <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-white/10 bg-neutral-900 shrink-0">
                  <Image src={p.images[0]} alt={p.title} fill className="object-cover" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/80 text-[10px] font-mono text-brand-gold font-bold uppercase">
                    {p.category}
                  </span>
                  <span className="absolute bottom-2 right-2 px-2.5 py-1 rounded-xl bg-black/90 text-xs font-mono text-white font-black">
                    ${p.price.toFixed(2)}
                  </span>
                </div>

                <div className="min-w-0">
                  <h4 className="font-bold text-white text-sm truncate group-hover:text-emerald-300 transition-colors">
                    {p.title}
                  </h4>
                  <p className="text-[11px] text-neutral-400 line-clamp-2 mt-0.5">{p.description}</p>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.inStock
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {p.inStock ? 'In Vault' : 'Sold Out'}
                  </span>

                  <button
                    onClick={() =>
                      setItemToDelete({
                        id: p.id,
                        type: 'merch',
                        title: p.title,
                        subtitle: `${p.category.toUpperCase()} • $${p.price.toFixed(2)}`,
                        coverUrl: p.images[0],
                        price: p.price,
                        meta: `Category: ${p.category} • ${p.inStock ? 'In Stock' : 'Out of Stock'}`,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/15 hover:bg-red-600 border border-red-500/40 text-red-300 hover:text-white text-xs font-bold transition-all hover:scale-105 active:scale-95"
                    title="Delete product from platform store"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Merch</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PERFORMANCE & FUNNEL ANALYTICS                                         */}
      {/* ========================================================================= */}
      {subTab === 'analytics' && (
        <div className="space-y-8">
          {/* Top E-Commerce KPI summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl glass-panel border border-brand-gold/30 space-y-1">
              <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-brand-gold" />
                Total Catalog Revenue
              </span>
              <p className="text-2xl font-black text-white font-mono">${totalRevenue.toLocaleString()}</p>
            </div>

            <div className="p-4 rounded-2xl glass-panel border border-white/5 space-y-1">
              <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                Completed Orders
              </span>
              <p className="text-2xl font-black text-emerald-400 font-mono">{totalPurchases.toLocaleString()}</p>
            </div>

            <div className="p-4 rounded-2xl glass-panel border border-white/5 space-y-1">
              <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-brand-neon" />
                Average Order Value (AOV)
              </span>
              <p className="text-2xl font-black text-brand-gold font-mono">${avgOrderValue}</p>
            </div>

            <div className="p-4 rounded-2xl glass-panel border border-white/5 space-y-1">
              <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-blue-400" />
                Active SKUs in Vault
              </span>
              <p className="text-2xl font-black text-white font-mono">{liveProducts.length}</p>
            </div>
          </div>

          {/* Visual Customer Funnel & Revenue Leaderboard */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ConversionFunnelChart stages={funnelStages} />

            <BarRankingChart
              title="Highest Revenue Merchandise Products"
              subtitle="Top grossing vinyl editions, heavyweight apparel, and physical collectibles"
              items={topRevenueRankingItems}
              icon={ShoppingBag}
              barColor="from-brand-gold via-brand-amber to-emerald-400"
            />
          </div>

          {/* Detailed Product Performance Table with Actions */}
          <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-brand-gold" />
                  Complete Merchandise Performance & Inventory Intelligence
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Detailed tracking of clicks, impressions, conversion rates, stock availability, and revenue per SKU
                </p>
              </div>
            </div>

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-neutral-400 uppercase font-mono text-[10px]">
                    <th className="py-3 px-2">#</th>
                    <th className="py-3 px-3">Product Name / Category</th>
                    <th className="py-3 px-3 text-right">Price</th>
                    <th className="py-3 px-3 text-right">Views</th>
                    <th className="py-3 px-3 text-right">Clicks (CTR)</th>
                    <th className="py-3 px-3 text-right">Cart Adds</th>
                    <th className="py-3 px-3 text-right">Purchases</th>
                    <th className="py-3 px-3 text-right">Conv. Rate</th>
                    <th className="py-3 px-3 text-right">Revenue</th>
                    <th className="py-3 px-3 text-right">Stock</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {activeAnalyticsProducts.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                      <td className="py-3 px-2 text-neutral-400 font-bold">#{idx + 1}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-neutral-900">
                            <Image src={p.images[0]} alt={p.title} fill className="object-cover" />
                          </div>
                          <div className="min-w-0 font-sans">
                            <p className="font-bold text-white truncate group-hover:text-brand-gold transition-colors">
                              {p.title}
                            </p>
                            <p className="text-[10px] text-neutral-400 uppercase tracking-wider">{p.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-brand-gold">${p.price.toFixed(2)}</td>
                      <td className="py-3 px-3 text-right text-neutral-300">{p.views.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-purple-300">
                        {p.clicks.toLocaleString()} ({p.ctr}%)
                      </td>
                      <td className="py-3 px-3 text-right text-amber-300">{p.cartAdditions.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-400">
                        {p.purchases.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-300">{p.conversionRate}%</td>
                      <td className="py-3 px-3 text-right font-black text-white">${p.revenue.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.inStock
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {p.inStock ? `${p.inventoryCount} in Vault` : 'Out of Stock'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() =>
                            setItemToDelete({
                              id: p.id,
                              type: 'merch',
                              title: p.title,
                              subtitle: `${p.category.toUpperCase()} • $${p.price.toFixed(2)}`,
                              coverUrl: p.images[0],
                              price: p.price,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600/15 hover:bg-red-600 border border-red-500/30 text-red-300 hover:text-white text-[10px] font-bold transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Deletion Modal */}
      <ConfirmDeletionModal
        isOpen={Boolean(itemToDelete)}
        item={itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDeletion}
        isDeleting={isDeleting}
      />
    </div>
  );
};
