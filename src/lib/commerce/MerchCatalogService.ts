import { Product } from '@/types/commerce';
import { MOCK_PRODUCTS } from '@/lib/mockData';
import { AuditLogger } from '@/lib/admin/AuditLogger';

const CUSTOM_MERCH_KEY = 'spades_custom_merch_v1';
const REMOVED_MERCH_KEY = 'spades_removed_merch_v1';

class MerchCatalogServiceClass {
  private customProducts: Product[] = [];
  private removedProductIds: string[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadState();
      window.addEventListener('storage', (e) => {
        if (e.key === CUSTOM_MERCH_KEY || e.key === REMOVED_MERCH_KEY) {
          this.loadState();
          this.notify();
        }
      });
      window.addEventListener('merch-catalog-updated', () => {
        this.loadState();
      });
    }
  }

  private loadState() {
    if (typeof window === 'undefined') return;
    try {
      const savedCustom = localStorage.getItem(CUSTOM_MERCH_KEY);
      if (savedCustom) {
        let items: Product[] = JSON.parse(savedCustom);
        // Sanitize any legacy 8 of spades or break beats references in user cache
        items = items.map((p) => {
          let updated = { ...p };
          if (/8\s*of\s*spades|return\s*of\s*the\s*break|break\s*beats/i.test(updated.title) || /8\s*of\s*spades|return\s*of\s*the\s*break/i.test(updated.description)) {
            const canonical = MOCK_PRODUCTS.find((m) => m.id === updated.id);
            if (canonical) updated = { ...canonical };
          }
          return updated;
        });
        this.customProducts = items;
      }
      const savedRemoved = localStorage.getItem(REMOVED_MERCH_KEY);
      if (savedRemoved) {
        this.removedProductIds = JSON.parse(savedRemoved);
      }
    } catch (e) {
      console.warn('Failed to load merch catalog state:', e);
    }
  }

  private persist() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CUSTOM_MERCH_KEY, JSON.stringify(this.customProducts));
      localStorage.setItem(REMOVED_MERCH_KEY, JSON.stringify(this.removedProductIds));
    } catch (e) {
      console.warn('Failed to persist merch catalog state:', e);
    }
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('MerchCatalogService listener error:', err);
      }
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('merch-catalog-updated'));
    }
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public getAllProducts(): Product[] {
    const customMap = new Map<string, Product>();
    this.customProducts.forEach((p) => customMap.set(p.id, p));

    const combined: Product[] = [...this.customProducts];
    MOCK_PRODUCTS.forEach((p) => {
      if (!customMap.has(p.id)) {
        combined.push(p);
      }
    });

    return combined.filter((p) => !this.removedProductIds.includes(p.id));
  }

  public getProductById(id: string): Product | undefined {
    return this.getAllProducts().find((p) => p.id === id);
  }

  public addProduct(product: Product): void {
    this.customProducts.unshift(product);
    this.removedProductIds = this.removedProductIds.filter((id) => id !== product.id);
    this.persist();
    this.notify();
  }

  public removeProduct(
    id: string,
    adminActor?: { id?: string; name?: string; email?: string; role?: string },
    reason?: string
  ): boolean {
    const product = this.getAllProducts().find((p) => p.id === id);
    if (!product) return false;

    this.customProducts = this.customProducts.filter((p) => p.id !== id);
    if (!this.removedProductIds.includes(id)) {
      this.removedProductIds.push(id);
    }
    this.persist();

    AuditLogger.logAction({
      adminId: adminActor?.id || 'usr-admin',
      adminName: adminActor?.name || adminActor?.email || 'Platform Administrator',
      adminRole: 'admin',
      eventType: 'MERCH_DELETED',
      action: `Deleted merchandise product "${product.title}" ($${product.price}) from live store catalog`,
      resource: 'Merchandise Catalog',
      resourceId: id,
      previousValue: {
        title: product.title,
        price: product.price,
        category: product.category,
      },
      newValue: {
        status: 'DELETED_FROM_STORE',
        deletedAt: new Date().toISOString(),
        deletedBy: adminActor?.name || 'Admin',
        reason: reason || 'Deleted from platform by administrator',
      },
      status: 'SUCCESS',
    });

    this.notify();
    return true;
  }
}

export const MerchCatalogService = new MerchCatalogServiceClass();
