/**
 * ChanceTEKone — Shared Cloud Catalog contracts
 *
 * The platform catalog (music, albums, folders, crates, audiobooks, videos,
 * podcasts and removal tombstones) lives in Firestore so that EVERY admin and
 * member sees the same content. Browsers only keep a local cache.
 */

export const CATALOG_COLLECTIONS = [
  'tracks',
  'albums',
  'folders',
  'crates',
  'audiobooks',
  'videos',
  'podcasts',
  'removed',
] as const;

export type CatalogCollection = (typeof CATALOG_COLLECTIONS)[number];

export interface CatalogDoc {
  id: string;
  [key: string]: any;
}

export interface CatalogSnapshot {
  /** Monotonic counter bumped on every successful admin write (0 = cloud never written). */
  revision: number;
  collections: Record<CatalogCollection, CatalogDoc[]>;
}

export interface CatalogOp {
  collection: CatalogCollection;
  op: 'set' | 'delete';
  id: string;
  data?: Record<string, any>;
}

export const CATALOG_META_COLLECTION = 'catalog_meta';
export const CATALOG_META_DOC = 'state';

export const firestoreCollectionName = (c: CatalogCollection) => `catalog_${c}`;

/** Firestore document ids cannot contain "/" — percent-encode anything unsafe. */
export const encodeDocId = (id: string): string => {
  const encoded = encodeURIComponent(id).replace(/\./g, '%2E');
  return encoded || '_';
};

export const emptySnapshot = (): CatalogSnapshot => ({
  revision: 0,
  collections: CATALOG_COLLECTIONS.reduce((acc, c) => {
    acc[c] = [];
    return acc;
  }, {} as Record<CatalogCollection, CatalogDoc[]>),
});

export const isCatalogCollection = (v: unknown): v is CatalogCollection =>
  typeof v === 'string' && (CATALOG_COLLECTIONS as readonly string[]).includes(v);
