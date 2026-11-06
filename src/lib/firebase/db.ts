import { collection, doc, getDocs, getDoc, setDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from './client';
import { MOCK_TRACKS, MOCK_ALBUMS, MOCK_ARTISTS, MOCK_VIDEOS, MOCK_AUDIOBOOKS, MOCK_PRODUCTS } from '@/lib/mockData';
import { PLATFORM_CANONICAL_TRACKS } from '@/lib/music/MusicCatalogService';
import { SocialCommentService } from '@/lib/social/SocialCommentService';
import { Track, Album, Artist, Video, Audiobook, Playlist } from '@/types/media';
import { Product } from '@/types/commerce';
import { Comment } from '@/types/social';
import { MerchCatalogService } from '@/lib/commerce/MerchCatalogService';

export const getTracks = async (): Promise<Track[]> => {
  try {
    const snap = await getDocs(collection(db, 'tracks'));
    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Track));
    }
  } catch (err) {
    // Graceful fallback to mock data
  }
  return [...MOCK_TRACKS, ...PLATFORM_CANONICAL_TRACKS];
};

export const getTrackById = async (id: string): Promise<Track | null> => {
  try {
    const snap = await getDoc(doc(db, 'tracks', id));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Track;
    }
  } catch (err) {
    // Graceful fallback
  }
  return MOCK_TRACKS.find((t) => t.id === id) || PLATFORM_CANONICAL_TRACKS.find((t) => t.id === id) || null;
};

export const getAlbums = async (): Promise<Album[]> => {
  try {
    const snap = await getDocs(collection(db, 'albums'));
    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Album));
    }
  } catch (err) {}
  return MOCK_ALBUMS;
};

export const getAlbumById = async (id: string): Promise<Album | null> => {
  try {
    const snap = await getDoc(doc(db, 'albums', id));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Album;
    }
  } catch (err) {}
  return MOCK_ALBUMS.find((a) => a.id === id) || null;
};

export const getArtists = async (): Promise<Artist[]> => {
  try {
    const snap = await getDocs(collection(db, 'artists'));
    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Artist));
    }
  } catch (err) {}
  return MOCK_ARTISTS;
};

export const getArtistById = async (id: string): Promise<Artist | null> => {
  try {
    const snap = await getDoc(doc(db, 'artists', id));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Artist;
    }
  } catch (err) {}
  return MOCK_ARTISTS.find((a) => a.id === id) || null;
};

export const getVideos = async (): Promise<Video[]> => {
  try {
    const snap = await getDocs(collection(db, 'videos'));
    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Video));
    }
  } catch (err) {}
  return MOCK_VIDEOS;
};

export const getVideoById = async (id: string): Promise<Video | null> => {
  try {
    const snap = await getDoc(doc(db, 'videos', id));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Video;
    }
  } catch (err) {}
  return MOCK_VIDEOS.find((v) => v.id === id) || null;
};

export const getAudiobooks = async (): Promise<Audiobook[]> => {
  try {
    const snap = await getDocs(collection(db, 'audiobooks'));
    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Audiobook));
    }
  } catch (err) {}
  return MOCK_AUDIOBOOKS;
};

export const getAudiobookById = async (id: string): Promise<Audiobook | null> => {
  try {
    const snap = await getDoc(doc(db, 'audiobooks', id));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Audiobook;
    }
  } catch (err) {}
  return MOCK_AUDIOBOOKS.find((ab) => ab.id === id) || null;
};

export const getProducts = async (): Promise<Product[]> => {
  try {
    const snap = await getDocs(collection(db, 'merchandise'));
    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
    }
  } catch (err) {}
  return MerchCatalogService.getAllProducts();
};

export const getProductById = async (id: string): Promise<Product | null> => {
  try {
    const snap = await getDoc(doc(db, 'merchandise', id));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Product;
    }
  } catch (err) {}
  return MerchCatalogService.getProductById(id) || null;
};

export const getCommentsForContent = async (contentId: string): Promise<Comment[]> => {
  try {
    const q = query(collection(db, 'comments'), where('contentId', '==', contentId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment));
    }
  } catch (err) {}
  return SocialCommentService.getComments(contentId) || [];
};
