'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Track, Audiobook, AudiobookChapter, Video } from '@/types/media';
import { Playlist, PlaylistItem } from '@/types/playlist';
import { MOCK_TRACKS, MOCK_VIDEOS, MOCK_AUDIOBOOKS } from '@/lib/mockData';
import { PlaylistService } from '@/lib/playlist/PlaylistService';
import { AnalyticsEngine } from '@/lib/analytics/AnalyticsEngine';
import { radioOrchestrator } from '@/lib/radio/RadioOrchestrator';
import { useAuth, getActiveSession } from '@/lib/auth/AuthContext';
import { AdminUserManager } from '@/lib/admin/AdminUserManager';
import { AuthModal } from '@/components/auth/AuthModal';
import { HistoryService } from '@/lib/history/HistoryService';
import { FavoritesService } from '@/lib/favorites/FavoritesService';
import { AudioStorageService } from '@/lib/audio/AudioStorageService';
import { EngagementMetricsService } from '@/lib/analytics/EngagementMetricsService';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { CloudCatalogClient } from '@/lib/catalog/CloudCatalogClient';
import {
  getAuthenticAudioUrl,
  isVerifiedServerUpload,
  getResilientAudioFallback,
  getSameArtistEmergencyFallback,
  isCrossArtistAudioMismatch,
} from '@/lib/music/authenticAudioMap';
import {
  describeAudioRef,
  logAudioDiag,
  normalizePlayableUrl,
  redactAudioUrl,
  unescapeIndexedDbUrl,
} from '@/lib/music/audioAssetIntegrity';
import {
  normalizeTrackTitle,
  normalizeArtistName,
  normalizeAlbumTitle,
  resolveSafeAudioUrl,
  isMissingOrGenericCover,
} from '@/lib/music/musicMetadataNormalizer';

type RepeatMode = 'off' | 'all' | 'one';

interface PlayerContextType {
  currentTrack: Track | null;
  currentAudiobook: Audiobook | null;
  currentChapter: AudiobookChapter | null;
  activeVideoModal: Video | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: RepeatMode;
  playbackRate: number;
  queue: Track[];
  historyQueue: Track[];
  isFullScreenOpen: boolean;
  likedTrackIds: Set<string>;
  isPlayerCollapsed: boolean;
  isPlayerVisible: boolean;

  // Actions
  playTrack: (track: Track, newQueue?: Track[], precedingTracks?: Track[], preserveExistingQueue?: boolean) => void;
  playAudiobookChapter: (audiobook: Audiobook, chapter: AudiobookChapter) => void;
  playPlaylist: (playlist: Playlist, startIndex?: number, shuffle?: boolean) => void;
  openVideoModal: (video: Video) => void;
  closeVideoModal: () => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setPlaybackRate: (rate: number) => void;
  playNext: () => void;
  playPrev: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  openFullScreen: () => void;
  closeFullScreen: () => void;
  toggleLikeTrack: (trackId: string) => void;
  togglePlayerCollapse: () => void;
  collapsePlayer: () => void;
  expandPlayer: () => void;
  closePlayer: () => void;
  openPlayer: () => void;
  requireStreamAuth: (actionName?: string) => boolean;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

/**
 * Resolves artwork and media URLs to fully qualified absolute URLs.
 * Required by iOS Lock Screen (MPNowPlayingInfoCenter) and Android MediaSession,
 * which silently drop or fail to render relative image paths when the device is locked.
 */
function toAbsoluteMediaUrl(url?: string | null): string {
  if (!url) {
    return typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : 'https://chancetekone.us/logo.png';
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const clean = url.startsWith('/') ? url : `/${url}`;
  return typeof window !== 'undefined' ? `${window.location.origin}${clean}` : `https://chancetekone.us${clean}`;
}

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, user, isAdmin, isSuperUser, isDemo } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const isAdminRef = useRef(isAdmin);
  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  const isSuperUserRef = useRef(isSuperUser);
  useEffect(() => {
    isSuperUserRef.current = isSuperUser;
  }, [isSuperUser]);

  const isDemoRef = useRef(isDemo);
  useEffect(() => {
    isDemoRef.current = isDemo;
  }, [isDemo]);

  const [isAuthGateModalOpen, setIsAuthGateModalOpen] = useState(false);
  const [authGateActionName, setAuthGateActionName] = useState('stream music and video');

  /**
   * Authoritative check: Returns true if the user is an administrator or registered platform member.
   * Only visitors that do NOT have an account return false and are gated.
   */
  const checkIsMemberOrAdmin = useCallback((): boolean => {
    // 1. Live React auth state
    if (profile || user || isAdmin || isSuperUser || isDemo) {
      return true;
    }
    // 2. Ref mirrors to bypass any stale closures in event loops or callbacks
    if (
      profileRef.current ||
      userRef.current ||
      isAdminRef.current ||
      isSuperUserRef.current ||
      isDemoRef.current
    ) {
      return true;
    }
    // 3. Persistent session storage (localStorage)
    if (typeof window !== 'undefined') {
      try {
        const sess = getActiveSession();
        if (sess && sess.profile && sess.profile.email) {
          const adminUser =
            AdminUserManager.getUserById(sess.profile.id) ||
            AdminUserManager.getUserByEmail(sess.profile.email);
          const isRevoked =
            adminUser &&
            (adminUser.status === 'suspended' ||
              adminUser.status === 'deleted' ||
              adminUser.status === 'disabled');
          if (!isRevoked) {
            return true;
          }
        }
      } catch {}
    }
    return false;
  }, [profile, user, isAdmin, isSuperUser, isDemo]);

  const requireStreamAuth = useCallback((actionName = 'stream music and video'): boolean => {
    if (checkIsMemberOrAdmin()) {
      return true;
    }
    // Only unauthenticated visitors without an account are gated and redirected to sign up
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {}
    }
    setIsPlaying(false);
    setAuthGateActionName(actionName);
    setIsAuthGateModalOpen(true);
    return false;
  }, [checkIsMemberOrAdmin]);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(() => {
    const list = MusicCatalogService.getSSRBaselineTracks();
    return list[0] || null;
  });
  const [currentAudiobook, setCurrentAudiobook] = useState<Audiobook | null>(null);
  const [currentChapter, setCurrentChapter] = useState<AudiobookChapter | null>(null);
  const [activeVideoModal, setActiveVideoModal] = useState<Video | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const lastPositionUpdateRef = useRef<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(194);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isShuffled, setIsShuffled] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [playbackRate, setPlaybackRateState] = useState<number>(1);
  const [queue, setQueue] = useState<Track[]>(() => {
    const list = MusicCatalogService.getSSRBaselineTracks();
    return list.slice(1);
  });
  const [historyQueue, setHistoryQueue] = useState<Track[]>([]);
  const [isFullScreenOpen, setIsFullScreenOpen] = useState<boolean>(false);
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());
  const [isPlayerCollapsed, setIsPlayerCollapsed] = useState<boolean>(false);
  const [isPlayerVisible, setIsPlayerVisible] = useState<boolean>(false); // Closed by default on screen

  const queueRef = useRef<Track[]>([]);
  const historyQueueRef = useRef<Track[]>([]);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    historyQueueRef.current = historyQueue;
  }, [historyQueue]);

  const repeatModeRef = useRef<RepeatMode>('off');
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  const lastPrevClickTimeRef = useRef<number>(0);
  const playNextRef = useRef<() => void>(() => {});
  const playPrevRef = useRef<() => void>(() => {});
  const playTrackRef = useRef<(track: Track, newQueue?: Track[], precedingTracks?: Track[], preserveExistingQueue?: boolean) => Promise<void>>((async () => {}) as any);

  // Sync player queue and active track with dynamic catalog changes (uploads/deletions)
  useEffect(() => {
    const syncWithCatalog = () => {
      const active = MusicCatalogService.getAllTracks();
      setCurrentTrack((prev) => {
        if (!prev) return active[0] || null;

        // If currently playing a staging upload / audition track, do NOT evict it!
        const isStagingAudition =
          prev.id.startsWith('up-') ||
          prev.id.startsWith('sim-up-') ||
          prev.id.startsWith('item-') ||
          prev.id.startsWith('upload-') ||
          prev.id.startsWith('stage-') ||
          prev.id.startsWith('scan-');
        if (isStagingAudition) {
          return prev;
        }

        const isRemoved = MusicCatalogService.isTrackPermanentlyRemoved(prev.id, prev.title, prev.artistName);
        if (isRemoved) {
          if (audioRef.current) {
            try {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
              audioRef.current.src = '';
            } catch {
              // ignore
            }
          }
          setIsPlaying(false);
          return active[0] || null;
        }
        const exists = active.find((t) => t.id === prev.id);
        if (exists) return exists;
        // Track no longer exists in active catalog (permanently removed or purged)
        if (audioRef.current) {
          try {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.src = '';
          } catch {
            // ignore
          }
        }
        setIsPlaying(false);
        return active[0] || null;
      });
      setQueue((prevQueue) => {
        const activeIds = new Set(active.map((t) => t.id));
        const filtered = prevQueue.filter(
          (t) => activeIds.has(t.id) && !MusicCatalogService.isTrackPermanentlyRemoved(t.id, t.title, t.artistName)
        );
        return filtered.length > 0 ? filtered : active.slice(1);
      });
    };

    syncWithCatalog();
    const unsub = MusicCatalogService.subscribe(syncWithCatalog);
    window.addEventListener('catalog-updated', syncWithCatalog);
    window.addEventListener('storage', syncWithCatalog);
    return () => {
      unsub();
      window.removeEventListener('catalog-updated', syncWithCatalog);
      window.removeEventListener('storage', syncWithCatalog);
    };
  }, []);

  // Sync liked tracks with user favorites in real-time
  useEffect(() => {
    const userId = profile?.id || 'guest';
    const favs = FavoritesService.getFavoritesByCategory('music', userId);
    setLikedTrackIds(new Set(favs.map((f) => f.id)));

    const unsubscribe = FavoritesService.subscribe(userId, (allFavs) => {
      const musicFavs = allFavs.filter((f) => f.category === 'music');
      setLikedTrackIds(new Set(musicFavs.map((f) => f.id)));
    });

    return () => unsubscribe();
  }, [profile?.id]);

  const openVideoModal = (video: Video) => {
    if (!requireStreamAuth('watch 4K video')) return;
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    setActiveVideoModal(video);

    if (profile?.id) {
      HistoryService.recordHistory(profile.id, {
        mediaId: video.id,
        mediaType: 'video',
        title: video.title,
        subtitle: video.artistName || video.category || '4K Video',
        coverUrl: video.thumbnailUrl || '/images/logo.png',
        duration: video.duration || 0,
        videoUrl: video.videoUrl,
      });
    }

    AnalyticsEngine.trackEvent({
      eventType: 'VIDEO_STARTED',
      action: `Started 4K video "${video.title}"`,
      resource: video.title,
      resourceId: video.id,
      platformArea: 'Videos',
      userId: profile?.id,
      userName: profile?.name,
      userEmail: profile?.email,
      metadata: { category: video.category, artist: video.artistName },
    });
  };
  const closeVideoModal = () => setActiveVideoModal(null);

  const currentTrackRef = useRef<Track | null>(null);
  /** Id of the track whose audio is currently loaded into the <audio> element. */
  const loadedTrackIdRef = useRef<string | null>(null);
  /** Monotonic selection counter: only the most recent playTrack() call may touch the audio element. */
  const playRequestSeqRef = useRef(0);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  // Initialize HTML5 Audio instance attached to document for mobile background resilience
  useEffect(() => {
    let audio = audioRef.current;
    if (!audio) {
      if (typeof document !== 'undefined') {
        const existing = document.getElementById('spades-global-audio') as HTMLAudioElement | null;
        if (existing) {
          audio = existing;
        } else {
          audio = new Audio();
          audio.id = 'spades-global-audio';
          audio.style.display = 'none';
          document.body.appendChild(audio);
        }
      } else {
        audio = new Audio();
      }
      audioRef.current = audio;
    }

    // Mobile PWA Background Audio Directives (iOS WebKit & Android Chrome Parity)
    audio.preload = 'auto';
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    audio.setAttribute('x-webkit-airplay', 'allow');
    audio.removeAttribute('crossorigin');

    const onTimeUpdate = () => {
      if (!audio) return;
      setCurrentTime(audio.currentTime);

      // Throttled MediaSession position update (prevents OS daemon thrashing)
      const now = Date.now();
      if (now - lastPositionUpdateRef.current > 1000) {
        lastPositionUpdateRef.current = now;
        if (
          typeof window !== 'undefined' &&
          'mediaSession' in navigator &&
          'setPositionState' in navigator.mediaSession &&
          audio.duration > 0 &&
          !isNaN(audio.duration) &&
          isFinite(audio.duration)
        ) {
          try {
            navigator.mediaSession.setPositionState({
              duration: audio.duration,
              playbackRate: audio.playbackRate || 1,
              position: Math.min(Math.max(0, audio.currentTime), audio.duration),
            });
          } catch {}
        }
      }
    };

    const onLoadedMetadata = () => {
      const dur = audio.duration || 0;
      setDuration(dur);
      if (
        typeof window !== 'undefined' &&
        'mediaSession' in navigator &&
        'setPositionState' in navigator.mediaSession &&
        dur > 0 &&
        !isNaN(dur) &&
        isFinite(dur)
      ) {
        try {
          navigator.mediaSession.setPositionState({
            duration: dur,
            playbackRate: audio.playbackRate || 1,
            position: Math.min(Math.max(0, audio.currentTime), dur),
          });
        } catch {}
      }
    };

    const onEnded = () => handleTrackEnded();
    const onPlay = () => {
      setIsPlaying(true);
      if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'playing';
        } catch {}
      }
    };
    const onPause = () => {
      setIsPlaying(false);
      if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'paused';
        } catch {}
      }
    };
    const onPlaying = () => {
      setIsPlaying(true);
      if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'playing';
        } catch {}
      }
    };
    const onWaiting = () => {
      // Audio stream is buffering - preserve lock-screen 'playing' state so controls remain responsive
      if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'playing';
        } catch {}
      }
    };

    const onError = (e: Event) => {
      if (
        !audio.src ||
        audio.src === '' ||
        (typeof window !== 'undefined' &&
          (audio.src === window.location.href ||
            audio.src.endsWith('/admin') ||
            audio.src.endsWith('/admin/')))
      ) {
        return;
      }
      console.warn('[PlayerContext] HTML5 Audio error on source:', audio.src, e);
      const failing = currentTrackRef.current;
      logAudioDiag({
        stage: 'media_error',
        trackId: failing?.id,
        assetKey: audio.src,
        source: loadedTrackIdRef.current === failing?.id ? 'current' : 'stale',
        status: String((audio.error && audio.error.code) || 'unknown'),
      });
      // Ignore errors from a source that belongs to a track the member has already moved away from.
      if (failing && (!loadedTrackIdRef.current || loadedTrackIdRef.current === failing.id)) {
        const recoverFromLocal = async (): Promise<string | null> => {
          if (failing.audioUrl && AudioStorageService.isIndexedDBUrl(failing.audioUrl)) {
            const byUrlId = await AudioStorageService.getAudioUrl(
              AudioStorageService.extractIdFromIndexedDBUrl(failing.audioUrl)
            );
            if (byUrlId) return byUrlId;
          }
          const byId = await AudioStorageService.getAudioUrl(failing.id);
          if (byId) return byId;
          const byMeta = await AudioStorageService.findAudioByTrack(failing);
          return byMeta?.url || null;
        };

        recoverFromLocal()
          .then((localBlob) => {
            if (currentTrackRef.current?.id !== failing.id) return; // selection changed while we were looking
            if (localBlob && audio.src !== localBlob) {
              console.info('[PlayerContext] Auto-recovering audio from IndexedDB local vault:', localBlob);
              loadedTrackIdRef.current = failing.id;
              audio.src = localBlob;
              audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
              return;
            }

            // Registered studio master for THIS artist (never another artist's recording).
            const fallback = getAuthenticAudioUrl(failing) || getSameArtistEmergencyFallback(failing);
            const normalizedFallback = fallback ? normalizePlayableUrl(fallback) : '';
            if (
              fallback &&
              !isCrossArtistAudioMismatch({ ...failing, audioUrl: fallback }) &&
              !audio.src.includes(normalizedFallback)
            ) {
              console.info('[PlayerContext] Auto-recovering audio using same-artist studio master:', fallback);
              loadedTrackIdRef.current = failing.id;
              audio.src = normalizedFallback;
              audio
                .play()
                .then(() => setIsPlaying(true))
                .catch((err) => console.warn('[PlayerContext] Auto-recovery play interrupted:', err));
            } else {
              console.warn('[PlayerContext] Playback failed: no audio asset resolves for this track record; not substituting another recording.');
              setIsPlaying(false);
            }
          })
          .catch(() => {
            setIsPlaying(false);
          });
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('error', onError);

    // Register this player's pause function with the radio orchestrator so
    // that tuning in to any radio station automatically pauses catalog playback.
    radioOrchestrator.setPauseCatalogPlayer(() => {
      audio.pause();
      setIsPlaying(false);
    });

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('error', onError);
      audio.pause();
    };
  }, []);

  // MediaSession API Integration: Metadata Updates (Decoupled from timeupdate to eliminate lock-screen flickering)
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    if (currentTrack) {
      const coverUrl = toAbsoluteMediaUrl(currentTrack.coverUrl);
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artistName || 'ChanceTEKone',
          album: currentTrack.albumTitle || (currentTrack.genre ? `${currentTrack.genre} · Return of the Break Beats` : 'Return of the Break Beats'),
          artwork: [
            { src: coverUrl, sizes: '96x96', type: 'image/png' },
            { src: coverUrl, sizes: '128x128', type: 'image/png' },
            { src: coverUrl, sizes: '192x192', type: 'image/png' },
            { src: coverUrl, sizes: '256x256', type: 'image/png' },
            { src: coverUrl, sizes: '384x384', type: 'image/png' },
            { src: coverUrl, sizes: '512x512', type: 'image/png' },
          ],
        });
      } catch (err) {
        console.warn('[PlayerContext] MediaMetadata error:', err);
      }
    } else if (currentAudiobook && currentChapter) {
      const coverUrl = toAbsoluteMediaUrl(currentAudiobook.coverUrl);
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentChapter.title,
          artist: currentAudiobook.narrator || currentAudiobook.author || 'ChanceTEKone',
          album: currentAudiobook.title,
          artwork: [
            { src: coverUrl, sizes: '192x192', type: 'image/png' },
            { src: coverUrl, sizes: '512x512', type: 'image/png' },
          ],
        });
      } catch (err) {
        console.warn('[PlayerContext] MediaMetadata error:', err);
      }
    }
  }, [currentTrack, currentAudiobook, currentChapter]);

  // MediaSession API Integration: Playback State Synchronization
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch {}
  }, [isPlaying]);

  // MediaSession API Integration: Lock-Screen & Headphone Action Handlers (Registered once with stable refs)
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    const setActionHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {}
    };

    setActionHandler('play', () => {
      if (audioRef.current && !isPlayingRef.current) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    });

    setActionHandler('pause', () => {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    });

    setActionHandler('stop', () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    });

    setActionHandler('previoustrack', () => {
      playPrevRef.current?.();
    });

    setActionHandler('nexttrack', () => {
      playNextRef.current?.();
    });

    setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && details.seekTime !== null && audioRef.current) {
        audioRef.current.currentTime = details.seekTime;
        setCurrentTime(details.seekTime);
      }
    });

    setActionHandler('seekbackward', (details) => {
      const offset = details.seekOffset || 10;
      if (audioRef.current) {
        const newTime = Math.max(0, audioRef.current.currentTime - offset);
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    });

    setActionHandler('seekforward', (details) => {
      const offset = details.seekOffset || 10;
      if (audioRef.current) {
        const maxDuration = audioRef.current.duration || 0;
        const newTime = Math.min(maxDuration, audioRef.current.currentTime + offset);
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    });
  }, []);

  const handleTrackEnded = () => {
    const track = currentTrackRef.current;
    if (track) {
      AnalyticsEngine.trackEvent({
        eventType: 'SONG_PLAY_COMPLETED',
        action: `Completed track "${track.title}"`,
        resource: track.title,
        resourceId: track.id,
        platformArea: 'Music',
        metadata: { duration: track.duration, artist: track.artistName },
      });
    }
    if (repeatModeRef.current === 'one' && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } else {
      playNextRef.current?.();
    }
  };

  const playTrack = async (
    track: Track,
    newQueue?: Track[],
    precedingTracks?: Track[],
    preserveExistingQueue = false
  ) => {
    if (!requireStreamAuth('stream music')) return;
    // Open the music player upon playing any song
    setIsPlayerVisible(true);
    setIsPlayerCollapsed(false);

    const isStagingAudition =
      track.id.startsWith('up-') ||
      track.id.startsWith('sim-up-') ||
      track.id.startsWith('item-') ||
      track.id.startsWith('upload-') ||
      track.id.startsWith('stage-') ||
      track.id.startsWith('scan-');
    if (isStagingAudition) {
      MusicCatalogService.unremoveTrack(track.id, track.title, track.artistName);
    } else if (MusicCatalogService.isTrackPermanentlyRemoved(track.id, track.title, track.artistName)) {
      console.warn('[PlayerContext] Cannot play permanently removed track:', track.title);
      return;
    }
    setActiveVideoModal(null);
    setCurrentAudiobook(null);
    setCurrentChapter(null);

    // Normalize full track title, full artist name, and full album title
    const normTitle = normalizeTrackTitle(track.title, track.artistName, track.albumTitle);
    const normArtist = normalizeArtistName(track.artistName, normTitle);
    const normAlbum = normalizeAlbumTitle(track.albumTitle, normArtist, normTitle);

    const resolvedCover = MusicCatalogService.resolveTrackCover({
      ...track,
      title: normTitle,
      artistName: normArtist,
      albumTitle: normAlbum,
    });
    const resolvedTrack: Track = {
      ...track,
      title: normTitle,
      artistName: normArtist,
      albumTitle: normAlbum,
      coverUrl: resolvedCover,
    };

    setCurrentTrack(resolvedTrack);

    AnalyticsEngine.trackEvent({
      eventType: 'SONG_PLAY_STARTED',
      action: `Started playing "${resolvedTrack.title}"`,
      resource: resolvedTrack.title,
      resourceId: resolvedTrack.id,
      platformArea: 'Music',
      userId: profile?.id,
      userName: profile?.name,
      userEmail: profile?.email,
      metadata: { artist: resolvedTrack.artistName, bpm: resolvedTrack.bpm, genre: resolvedTrack.genre },
    });

    if (profile?.id) {
      HistoryService.recordHistory(profile.id, {
        mediaId: resolvedTrack.id,
        mediaType: 'music',
        title: resolvedTrack.title,
        subtitle: resolvedTrack.artistName || 'ChanceTEKone',
        coverUrl: resolvedTrack.coverUrl || '/images/logo.png',
        duration: resolvedTrack.duration || 0,
        audioUrl: resolvedTrack.audioUrl,
      });
    }

    if (!preserveExistingQueue) {
      let finalUpcomingQueue = newQueue;
      let finalPrecedingQueue = precedingTracks;

      if (newQueue && newQueue.length > 0) {
        const trackIdx = newQueue.findIndex((t) => t.id === track.id);
        if (trackIdx !== -1) {
          finalUpcomingQueue = newQueue.slice(trackIdx + 1);
          if (!finalPrecedingQueue) {
            finalPrecedingQueue = newQueue.slice(0, trackIdx);
          }
        } else {
          finalUpcomingQueue = newQueue.filter((t) => t.id !== track.id);
        }
      } else if (!newQueue) {
        // Auto-discover sequence from album, crate, or general catalog so forward/next always works seamlessly
        const allTracks = MusicCatalogService.getAllTracks();
        let pool = allTracks;
        if (track.albumTitle) {
          const albumTracks = allTracks.filter(
            (t) => t.albumTitle && t.albumTitle.toLowerCase().trim() === track.albumTitle?.toLowerCase().trim()
          );
          if (albumTracks.length > 1) {
            pool = albumTracks;
          }
        } else if (track.crateId && track.crateId !== 'direct-music-library') {
          const crateTracks = MusicCatalogService.getTracksByCrate(track.crateId);
          if (crateTracks.length > 1) {
            pool = crateTracks;
          }
        }

        const idx = pool.findIndex(
          (t) =>
            t.id === track.id ||
            (t.title.toLowerCase().trim() === track.title.toLowerCase().trim() &&
              t.artistName?.toLowerCase().trim() === track.artistName?.toLowerCase().trim())
        );
        if (idx !== -1 && pool.length > 1) {
          finalUpcomingQueue = pool.slice(idx + 1);
          finalPrecedingQueue = pool.slice(0, idx);
          if (finalUpcomingQueue.length === 0) {
            finalUpcomingQueue = pool.slice(0, idx);
          }
        }
      }

      if (finalUpcomingQueue !== undefined) {
        setQueue(
          finalUpcomingQueue.filter(
            (t) => t.id !== track.id && !MusicCatalogService.isTrackPermanentlyRemoved(t.id, t.title, t.artistName)
          )
        );
      }
      if (finalPrecedingQueue !== undefined) {
        setHistoryQueue(
          finalPrecedingQueue.filter(
            (t) => t.id !== track.id && !MusicCatalogService.isTrackPermanentlyRemoved(t.id, t.title, t.artistName)
          )
        );
      }
    }

    currentTrackRef.current = resolvedTrack;

    // ── Selection → audio binding ───────────────────────────────────────────────────────────────
    // The selected record id, its resolved source and the <audio> element are changed TOGETHER, and only
    // by the most recent selection. Without this, a slow lookup from an earlier click could finish after a
    // later one and load the earlier song's audio under the newly selected song's title.
    const requestId = ++playRequestSeqRef.current;
    const isLatestSelection = () => playRequestSeqRef.current === requestId;
    // Seamless PWA Audio Transition: Avoid calling audio.pause() here. Setting audio.src
    // immediately reassigns the media stream without triggering an idle/paused state in
    // iOS WebKit or Android MediaSession when the screen is dark/locked.
    logAudioDiag({ stage: 'select', trackId: resolvedTrack.id, assetKey: track.audioUrl, status: `req#${requestId}` });

    // 1. The authoritative source is the audio reference stored on the selected track's OWN record.
    let resolvedAudioUrl = unescapeIndexedDbUrl(track.audioUrl || '');
    let sourceTier = 'record';
    const ownRef = describeAudioRef(resolvedAudioUrl);
    const isUnverifiedUploadPath = ownRef.kind === 'server_upload' && !isVerifiedServerUpload(resolvedAudioUrl);

    // Breakbeat Anthem immediate mapping
    if (
      track.title?.toLowerCase().includes('return of the break beats') ||
      track.id === 'track-1'
    ) {
      resolvedAudioUrl = '/audio/Fort_Apache.mp3';
      sourceTier = 'breakbeat_anthem';
    }

    // 2. Browser-local audio is consulted when the record has no shareable reference of its own
    //    (empty / indexeddb:// / unverified container-disk /audio/uploads/ path), and ONLY by this
    //    record's exact id or exact song+artist match.
    if ((ownRef.kind === 'none' || ownRef.kind === 'indexeddb' || isUnverifiedUploadPath) && track.id && sourceTier !== 'breakbeat_anthem') {
      let localBlob: string | null = null;
      if (ownRef.kind === 'indexeddb') {
        localBlob = await AudioStorageService.getAudioUrl(AudioStorageService.extractIdFromIndexedDBUrl(resolvedAudioUrl));
      }
      if (!localBlob) localBlob = await AudioStorageService.getAudioUrl(track.id);
      if (!localBlob) {
        // Strict (exact title AND artist) recovery of audio saved under another id for the same song.
        const found =
          (await AudioStorageService.findAudioByTrack(resolvedTrack)) ||
          (await AudioStorageService.findAudioByTrack(track));
        if (found?.url) localBlob = found.url;
      }
      if (localBlob) {
        resolvedAudioUrl = localBlob;
        sourceTier = 'local_vault';
        // If this browser is an admin writer and the track's cloud URL is not yet in Firebase Storage,
        // enqueue it now so all browsers receive the durable Firebase Storage stream.
        if (
          CloudCatalogClient.isWriter() &&
          !String(track.audioUrl || '').startsWith('https://firebasestorage.googleapis.com/')
        ) {
          CloudCatalogClient.enqueue([
            { collection: 'tracks', op: 'set', id: resolvedTrack.id, data: resolvedTrack as any },
          ]);
        }
      } else if (ownRef.kind === 'indexeddb' || isUnverifiedUploadPath) {
        resolvedAudioUrl = ''; // a browser-local or ephemeral container-disk reference that does not exist here -> falls through to step 5
      }
      if (!isLatestSelection()) {
        logAudioDiag({ stage: 'superseded', trackId: resolvedTrack.id, status: `req#${requestId}` });
        return;
      }
    }

    // 4. Verify that the resolved audio does not cross-wire to a different artist
    if (resolvedAudioUrl && isCrossArtistAudioMismatch({ ...resolvedTrack, audioUrl: resolvedAudioUrl })) {
      console.warn('[PlayerContext] Cross-artist audio mismatch detected and prevented for track:', resolvedTrack.title, 'Source was:', redactAudioUrl(resolvedAudioUrl));
      // Registered studio master for THIS exact artist + song (never another recording)
      const authenticSameArtist = getAuthenticAudioUrl(resolvedTrack);
      if (authenticSameArtist && !isCrossArtistAudioMismatch({ ...resolvedTrack, audioUrl: authenticSameArtist })) {
        resolvedAudioUrl = authenticSameArtist;
        sourceTier = 'registered_master';
      } else {
        // Fall back to local uploaded blob if available (exact record id)
        const localBlob = track.id ? await AudioStorageService.getAudioUrl(track.id) : null;
        if (!isLatestSelection()) {
          logAudioDiag({ stage: 'superseded', trackId: resolvedTrack.id, status: `req#${requestId}` });
          return;
        }
        if (localBlob) {
          resolvedAudioUrl = localBlob;
          sourceTier = 'local_vault';
        } else {
          // Zero tolerance: clear mismatched audio URL so unrelated artist is NEVER played!
          resolvedAudioUrl = '';
        }
      }
    }

    // 5. If the record has no audio reference at all (and no local blob exists in this browser),
    //    fall back to registered studio master or same-artist studio audio (never another artist).
    if (!resolvedAudioUrl || resolvedAudioUrl === 'null' || resolvedAudioUrl === 'undefined') {
      const authenticAudio =
        getAuthenticAudioUrl(resolvedTrack) ||
        getResilientAudioFallback(resolvedTrack) ||
        getSameArtistEmergencyFallback(resolvedTrack);
      if (authenticAudio && !isCrossArtistAudioMismatch({ ...resolvedTrack, audioUrl: authenticAudio })) {
        resolvedAudioUrl = authenticAudio;
        sourceTier = 'registered_master';
      } else {
        resolvedAudioUrl = '';
      }
    }

    // Space sanitization for Fort Apache if specifically playing that track
    if (resolvedAudioUrl === '/audio/Fort Apache.mp3') {
      resolvedAudioUrl = '/audio/Fort_Apache.mp3';
    }

    // Make relative paths URI-safe WITHOUT re-encoding already-encoded absolute URLs (Firebase `%2F`).
    resolvedAudioUrl = normalizePlayableUrl(resolvedAudioUrl);

    if (!isLatestSelection()) {
      logAudioDiag({ stage: 'superseded', trackId: resolvedTrack.id, status: `req#${requestId}` });
      return;
    }

    if (!resolvedAudioUrl) {
      loadedTrackIdRef.current = null;
      setIsPlaying(false);
      logAudioDiag({ stage: 'media_error', trackId: resolvedTrack.id, source: sourceTier, status: 'no_audio_reference' });
      return;
    }

    logAudioDiag({ stage: 'resolved', trackId: resolvedTrack.id, assetKey: resolvedAudioUrl, source: sourceTier, status: `req#${requestId}` });

    let audio = audioRef.current;
    if (!audio && typeof window !== 'undefined') {
      audio = (document.getElementById('spades-global-audio') as HTMLAudioElement | null) || new Audio();
      audio.id = 'spades-global-audio';
      audio.style.display = 'none';
      if (!audio.parentNode && typeof document !== 'undefined') {
        document.body.appendChild(audio);
      }
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      audio.setAttribute('x-webkit-airplay', 'allow');
      audio.removeAttribute('crossorigin');
      audioRef.current = audio;
    }

    if (audio) {
      loadedTrackIdRef.current = resolvedTrack.id;
      audio.removeAttribute('crossorigin');
      audio.src = resolvedAudioUrl;
      audio.playbackRate = playbackRate;
      audio.volume = isMuted ? 0 : volume;
      audio
        .play()
        .then(() => {
          if (isLatestSelection()) setIsPlaying(true);
        })
        .catch(async (err) => {
          // A newer selection (or a src change) legitimately aborts this play() — not a failure.
          if (!isLatestSelection() || err?.name === 'AbortError') return;
          console.warn('[PlayerContext] Playback interrupted for track:', resolvedTrack.title, err);
          // Retry only with the registered master of this artist, if one exists and differs.
          const fallback = getAuthenticAudioUrl(resolvedTrack) || getSameArtistEmergencyFallback(resolvedTrack);
          const normalizedFallback = fallback ? normalizePlayableUrl(fallback) : '';
          if (
            fallback &&
            !isCrossArtistAudioMismatch({ ...resolvedTrack, audioUrl: fallback }) &&
            !audio.src.includes(normalizedFallback)
          ) {
            console.info('[PlayerContext] Retrying playback with registered master for this exact song:', fallback);
            audio.removeAttribute('crossorigin');
            audio.src = normalizedFallback;
            audio
              .play()
              .then(() => {
                if (isLatestSelection()) setIsPlaying(true);
              })
              .catch(() => setIsPlaying(false));
          } else {
            setIsPlaying(false);
          }
        });
    }
  };

  playTrackRef.current = playTrack;
  useEffect(() => {
    playTrackRef.current = playTrack;
  }, [playTrack]);

  const playAudiobookChapter = (audiobook: Audiobook, chapter: AudiobookChapter) => {
    if (!requireStreamAuth('listen to audiobooks')) return;
    setActiveVideoModal(null);
    setCurrentTrack(null);
    setCurrentAudiobook(audiobook);
    setCurrentChapter(chapter);

    AnalyticsEngine.trackEvent({
      eventType: 'AUDIOBOOK_STARTED',
      action: `Started audiobook "${audiobook.title}" Chapter ${chapter.chapterIndex}: ${chapter.title}`,
      resource: audiobook.title,
      resourceId: audiobook.id,
      platformArea: 'Audiobooks',
      userId: profile?.id,
      userName: profile?.name,
      userEmail: profile?.email,
      metadata: { chapterTitle: chapter.title, author: audiobook.author, narrator: audiobook.narrator },
    });

    if (profile?.id) {
      HistoryService.recordHistory(profile.id, {
        mediaId: audiobook.id,
        mediaType: 'audiobook',
        title: audiobook.title,
        subtitle: `Ch. ${chapter.chapterIndex}: ${chapter.title}`,
        coverUrl: audiobook.coverUrl || '/images/logo.png',
        duration: chapter.duration || 0,
        audioUrl: chapter.audioUrl,
      });
    }

    if (audioRef.current) {
      audioRef.current.src = chapter.audioUrl;
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.warn('Autoplay prevented:', err));
    }
  };

  const playPlaylist = (playlist: Playlist, startIndex = 0, shuffle = false) => {
    if (!requireStreamAuth('stream playlists')) return;
    if (!playlist.items || playlist.items.length === 0) return;
    PlaylistService.recordPlaylistPlay(playlist.id);

    // Filter out permanently deleted content
    let itemsToPlay = playlist.items.filter((it) => {
      if (it.mediaType === 'music') {
        return !MusicCatalogService.isTrackPermanentlyRemoved(it.mediaId, it.title, it.artistName);
      }
      if (it.mediaType === 'audiobook') {
        return !MediaCatalogService.isAudiobookPermanentlyRemoved(it.mediaId, it.title);
      }
      if (it.mediaType === 'video') {
        return !MediaCatalogService.isVideoPermanentlyRemoved(it.mediaId, it.title);
      }
      return true;
    });

    if (itemsToPlay.length === 0) return;

    if (shuffle) {
      itemsToPlay = [...itemsToPlay].sort(() => Math.random() - 0.5);
    }

    const startItem = itemsToPlay[startIndex] || itemsToPlay[0];

    // Play initial item based on media type
    if (startItem.mediaType === 'music') {
      const resolvePlaylistTrack = (it: PlaylistItem): Track => {
        return (
          MusicCatalogService.getTrackById(it.mediaId) ||
          MusicCatalogService.getAllTracks().find(
            (t) => t.id === it.mediaId || t.title.toLowerCase().trim() === it.title.toLowerCase().trim()
          ) || {
            id: it.mediaId,
            title: it.title,
            artistId: 'artist-1',
            artistName: it.artistName,
            audioUrl: it.audioUrl || '',
            coverUrl: it.coverUrl,
            duration: it.duration,
            genre: it.genre || 'R&B / Soul',
            bpm: it.bpm || 100,
            playCount: 0,
            likeCount: 0,
            dislikeCount: 0,
            commentCount: 0,
          }
        );
      };

      const track = resolvePlaylistTrack(startItem);
      const precedingTracks: Track[] = itemsToPlay
        .slice(0, startIndex)
        .filter((it) => it.mediaType === 'music')
        .map(resolvePlaylistTrack);
      const upcomingTracks: Track[] = itemsToPlay
        .slice(startIndex + 1)
        .filter((it) => it.mediaType === 'music')
        .map(resolvePlaylistTrack);

      playTrack(track, upcomingTracks, precedingTracks);
    } else if (startItem.mediaType === 'video') {
      const vid = MOCK_VIDEOS.find((v) => v.id === startItem.mediaId) || {
        id: startItem.mediaId,
        title: startItem.title,
        artistId: 'artist-1',
        artistName: startItem.artistName,
        videoUrl: startItem.videoUrl || '/videos/FatherTime4K.mp4',
        thumbnailUrl: startItem.coverUrl,
        duration: startItem.duration,
        views: 0,
        likeCount: 0,
        dislikeCount: 0,
        commentCount: 0,
        description: 'Playlist video track',
        category: 'Music Video',
        releaseDate: '2026-02-28',
      };
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
      setActiveVideoModal(vid);
    } else if (startItem.mediaType === 'audiobook') {
      const book = MOCK_AUDIOBOOKS.find((b) => b.id === startItem.mediaId) || MOCK_AUDIOBOOKS[0];
      const chapter =
        book.chapters.find((c) => c.chapterIndex === (startItem.chapterIndex || 1)) || book.chapters[0];
      playAudiobookChapter(book, chapter);
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const resume = () => {
    if (!requireStreamAuth('stream music')) return;
    setIsPlayerVisible(true);
    if (audioRef.current) {
      const src = audioRef.current.src || '';
      const needsFullResolve =
        !src ||
        src === (typeof window !== 'undefined' ? window.location.href : '') ||
        /(?:^|\/)indexeddb(?:%3a|:)\/\//i.test(src) ||
        Boolean(audioRef.current.error) ||
        (currentTrack && loadedTrackIdRef.current !== currentTrack.id);
      if (needsFullResolve && currentTrack) {
        void playTrack(currentTrack);
        return;
      }
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Play error:', err);
          if (currentTrack) {
            void playTrack(currentTrack);
          }
        });
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      pause();
    } else {
      if (!requireStreamAuth('stream music')) return;
      resume();
    }
  };

  const seek = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const setVolume = (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : clamped;
    }
    // Sync volume to active radio station so the platform slider controls all audio
    const activeRadioStation = radioOrchestrator.getActiveStation();
    if (activeRadioStation) radioOrchestrator.setVolume(activeRadioStation, isMuted ? 0 : clamped);
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (audioRef.current) {
      audioRef.current.volume = nextMute ? 0 : volume;
    }
  };

  const toggleShuffle = () => setIsShuffled(!isShuffled);

  const toggleRepeat = () => {
    if (repeatMode === 'off') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('off');
  };

  const setPlaybackRate = (rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const playNext = useCallback(() => {
    // 1. If queue has upcoming tracks, take the next track from queue
    const liveQueue = queueRef.current;
    if (liveQueue && liveQueue.length > 0) {
      const nextTrack = isShuffled
        ? liveQueue[Math.floor(Math.random() * liveQueue.length)]
        : liveQueue[0];
      const remainingQueue = liveQueue.filter((t) => t.id !== nextTrack.id);
      if (currentTrackRef.current) {
        setHistoryQueue((prev) => [...prev, currentTrackRef.current!]);
        historyQueueRef.current = [...historyQueueRef.current, currentTrackRef.current!];
      }
      setQueue(remainingQueue);
      queueRef.current = remainingQueue;
      void playTrackRef.current(nextTrack, remainingQueue, undefined, true);
      return;
    }

    // 2. If queue is empty, dynamically discover the next track in the album, crate, or catalog
    const curr = currentTrackRef.current;
    if (curr) {
      const allTracks = MusicCatalogService.getAllTracks();
      let pool = allTracks;
      if (curr.albumTitle) {
        const albumTracks = allTracks.filter(
          (t) => t.albumTitle && t.albumTitle.toLowerCase().trim() === curr.albumTitle?.toLowerCase().trim()
        );
        if (albumTracks.length > 1) {
          pool = albumTracks;
        }
      } else if (curr.crateId && curr.crateId !== 'direct-music-library') {
        const crateTracks = MusicCatalogService.getTracksByCrate(curr.crateId);
        if (crateTracks.length > 1) {
          pool = crateTracks;
        }
      }

      const currIdx = pool.findIndex(
        (t) =>
          t.id === curr.id ||
          (t.title.toLowerCase().trim() === curr.title.toLowerCase().trim() &&
            t.artistName?.toLowerCase().trim() === curr.artistName?.toLowerCase().trim())
      );

      if (currIdx !== -1 && pool.length > 1) {
        const nextIdx = (currIdx + 1) % pool.length;
        const nextTrack = pool[nextIdx];
        const newUpcoming = pool.slice(nextIdx + 1);
        const newPreceding = pool.slice(0, nextIdx);

        setHistoryQueue((prev) => [...prev, curr]);
        historyQueueRef.current = [...historyQueueRef.current, curr];
        setQueue(newUpcoming);
        queueRef.current = newUpcoming;

        void playTrackRef.current(nextTrack, newUpcoming, newPreceding, false);
        return;
      }
    }

    // 3. Fallback: If no current track or single track, play first track of all tracks
    const all = MusicCatalogService.getAllTracks();
    if (all.length > 0) {
      void playTrackRef.current(all[0], all.slice(1), [], false);
    }
  }, [isShuffled]);

  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  const playPrev = useCallback(() => {
    const now = Date.now();
    const timeSinceLastClick = now - lastPrevClickTimeRef.current;
    // Clicked twice within 2.5 seconds: play previous song from history!
    const isDoubleClick = lastPrevClickTimeRef.current > 0 && timeSinceLastClick < 2500;

    if (isDoubleClick) {
      lastPrevClickTimeRef.current = 0;
      const history = historyQueueRef.current;
      if (history.length > 0) {
        const prevTrack = history[history.length - 1];
        const remainingHistory = history.slice(0, -1);
        if (currentTrackRef.current) {
          const newQ = [currentTrackRef.current, ...queueRef.current.filter((t) => t.id !== currentTrackRef.current!.id)];
          setQueue(newQ);
          queueRef.current = newQ;
        }
        setHistoryQueue(remainingHistory);
        historyQueueRef.current = remainingHistory;
        void playTrackRef.current(prevTrack, undefined, undefined, true);
        return;
      }

      // If history is empty, check album or catalog previous track
      const curr = currentTrackRef.current;
      if (curr) {
        const all = MusicCatalogService.getAllTracks();
        let pool = all;
        if (curr.albumTitle) {
          const albumTracks = all.filter(
            (t) => t.albumTitle && t.albumTitle.toLowerCase().trim() === curr.albumTitle?.toLowerCase().trim()
          );
          if (albumTracks.length > 1) pool = albumTracks;
        }
        const currIdx = pool.findIndex(
          (t) =>
            t.id === curr.id ||
            (t.title.toLowerCase().trim() === curr.title.toLowerCase().trim() &&
              t.artistName?.toLowerCase().trim() === curr.artistName?.toLowerCase().trim())
        );
        if (currIdx > 0) {
          const prevTrack = pool[currIdx - 1];
          void playTrackRef.current(prevTrack);
          return;
        }
      }

      // Boundary: restart current track
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      // First click: current song playing should restart!
      lastPrevClickTimeRef.current = now;
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  }, []);

  playPrevRef.current = playPrev;
  useEffect(() => {
    playPrevRef.current = playPrev;
  }, [playPrev]);

  const addToQueue = (track: Track) => {
    if (MusicCatalogService.isTrackPermanentlyRemoved(track.id, track.title, track.artistName)) {
      return;
    }
    setQueue((prev) => [...prev, track]);
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const openFullScreen = () => setIsFullScreenOpen(true);
  const closeFullScreen = () => setIsFullScreenOpen(false);

  const toggleLikeTrack = (trackId: string) => {
    const userId = profile?.id || 'guest';
    const userName = profile?.name || profile?.email || 'Guest Listener';
    const isCurrentlyLiked = likedTrackIds.has(trackId);
    
    // Resolve track info for authentic telemetry
    const matchedTrack = (currentTrack?.id === trackId ? currentTrack : null) || MusicCatalogService.getTrackById(trackId);
    const trackTitle = matchedTrack ? `${matchedTrack.title} (${matchedTrack.artistName})` : `Track ${trackId}`;
    const contextLocation = isFullScreenOpen ? 'Full-Screen Player' : 'Global Player Dock';

    EngagementMetricsService.recordInteraction({
      contentId: trackId,
      contentTitle: trackTitle,
      contentType: 'music',
      reactionType: 'heart',
      action: isCurrentlyLiked ? 'remove' : 'add',
      userId,
      userName,
      userEmail: profile?.email,
      contextLocation,
    });

    if (isCurrentlyLiked) {
      FavoritesService.removeFavorite(trackId, userId);
    } else {
      FavoritesService.addFavorite({ id: trackId, category: 'music' }, userId);
    }
  };

  const togglePlayerCollapse = () => setIsPlayerCollapsed((prev) => !prev);
  const collapsePlayer = () => setIsPlayerCollapsed(true);
  const expandPlayer = () => setIsPlayerCollapsed(false);
  const closePlayer = () => {
    setIsPlayerVisible(false);
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };
  const openPlayer = () => setIsPlayerVisible(true);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        currentAudiobook,
        currentChapter,
        activeVideoModal,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        isShuffled,
        repeatMode,
        playbackRate,
        queue,
        historyQueue,
        isFullScreenOpen,
        likedTrackIds,
        isPlayerCollapsed,
        isPlayerVisible,
        playTrack,
        playAudiobookChapter,
        playPlaylist,
        openVideoModal,
        closeVideoModal,
        pause,
        resume,
        togglePlay,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        toggleRepeat,
        setPlaybackRate,
        playNext,
        playPrev,
        addToQueue,
        removeFromQueue,
        openFullScreen,
        closeFullScreen,
        toggleLikeTrack,
        togglePlayerCollapse,
        collapsePlayer,
        expandPlayer,
        closePlayer,
        openPlayer,
        requireStreamAuth,
      }}
    >
      {children}
      <AuthModal
        isOpen={isAuthGateModalOpen}
        onClose={() => setIsAuthGateModalOpen(false)}
        title="Sign Up to Stream on ChanceTEKone"
        description="You must sign up for an account in order to stream music and video on the platform. Create your free account or sign in to continue."
        initialTab="signup"
        onSuccess={() => {
          setIsAuthGateModalOpen(false);
        }}
      />
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within a PlayerProvider');
  return context;
};
