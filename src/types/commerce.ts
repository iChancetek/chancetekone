export interface ProductVariant {
  id: string;
  name: string; // e.g. "Size S", "Black Vinyl"
  sku: string;
  price: number;
  inStock: boolean;
}

export interface Product {
  id: string;
  title: string;
  artistId?: string;
  artistName?: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  category: 'apparel' | 'vinyl' | 'accessories' | 'collectibles' | 'posters';
  variants: ProductVariant[];
  featured?: boolean;
  inStock: boolean;
  rating: number;
  reviewCount: number;
}

export interface CartItem {
  id: string; // `${productId}_${variantId}`
  productId: string;
  product: Product;
  variantId?: string;
  variantName?: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  shippingAddress: {
    name: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  createdAt: string;
}
