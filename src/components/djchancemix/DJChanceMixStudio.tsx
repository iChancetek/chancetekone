'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import {
  Disc3,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  Zap,
  ShieldCheck,
  Music2,
  ChevronDown,
  ChevronUp,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { usePlayer } from '@/lib/player/PlayerContext';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { PlaylistService } from '@/lib/playlist/PlaylistService';
import { Playlist } from '@/types/playlist';
import {
  DeckId,
  DEFAULT_MIX_CONFIGURATION,
  DJTrackSource,
  MIX_MODE_META,
  MixConfiguration,
  MixerEngineSnapshot,
  MixMode,
  PlaylistMixSettings,
  TrackAudioAnalysis,
} from '@/types/djchancemix';
import {
  importAuthorizedLocalAudioFiles,
  playlistToDJSources,
  trackToDJSource,
} from '@/lib/djchancemix/audioSourceProvider';
import { TrackAnalyzerService } from '@/lib/djchancemix/analyzerService';
import {
  optimizePlaylistFlow,
  pickSmartShuffleNext,
} from '@/lib/djchancemix/transitionIntelligence';
import { getSharedDJMixerEngine } from '@/lib/djchancemix/dualDeckEngine';
import { DJChanceMixConfigService } from '@/lib/djchancemix/configService';
import { DualDeckConsole } from './DualDeckConsole';
import { MixSettingsPanel } from './MixSettingsPanel';
import { MixQueuePanel } from './MixQueuePanel';

const MIX_MODES: MixMode[] = [
  'automix',
  'smart-crossfade',
  'beatsync',
  'harmonic',
  'continuous',
  'original',
];

function formatSec(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const DJChanceMixStudio: React.FC = () => {
  const searchParams = useSearchParams();
  const initialPlaylistParam = searchParams?.get('playlist') || null;
  const { profile, user, isAdmin } = useAuth();
  const { pause: pauseGlobalPlayer } = usePlayer();
  const currentUserId = profile?.id || user?.uid || 'guest';
  const currentEmail = profile?.email || user?.email || undefined;

  const engineRef = useRef(getSharedDJMixerEngine());
  const [snapshot, setSnapshot] = useState<MixerEngineSnapshot>(() =>
    engineRef.current.getSnapshot()
  );
  const [config, setConfig] = useState<MixConfiguration>(() =>
    DJChanceMixConfigService.loadLocalConfig()
  );
  const [showConsole, setShowConsole] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatPlaylist, setRepeatPlaylist] = useState(true);

  const [catalogTracks, setCatalogTracks] = useState<DJTrackSource[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(initialPlaylistParam);
  const [activePlaylistName, setActivePlaylistName] = useState<string>('ChanceTEK Studio Mix');
  const [playlistMixSettings, setPlaylistMixSettings] = useState<PlaylistMixSettings | null>(null);
  const [queue, setQueue] = useState<DJTrackSource[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [overrideNextTrack, setOverrideNextTrack] = useState<DJTrackSource | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, TrackAudioAnalysis>>({});
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const queueRef = useRef<DJTrackSource[]>(queue);
  const currentIndexRef = useRef<number>(currentIndex);
  const shuffleRef = useRef<boolean>(isShuffled);
  const repeatRef = useRef<boolean>(repeatPlaylist);
  const overrideNextRef = useRef<DJTrackSource | null>(overrideNextTrack);
  const analysesRef = useRef<Record<string, TrackAudioAnalysis>>(analyses);
  const configRef = useRef<MixConfiguration>(config);
  const playedHistoryRef = useRef<Set<string>>(new Set());

  queueRef.current = queue;
  currentIndexRef.current = currentIndex;
  shuffleRef.current = isShuffled;
  repeatRef.current = repeatPlaylist;
  overrideNextRef.current = overrideNextTrack;
  analysesRef.current = analyses;
  configRef.current = config;

  const notify = useCallback((msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast((cur) => (cur === msg ? null : cur)), 3600);
  }, []);

  // Load user MixConfiguration & sync from server
  useEffect(() => {
    const localCfg = DJChanceMixConfigService.loadLocalConfig();
    setConfig(localCfg);
    engineRef.current.updateConfig(localCfg);

    if (currentUserId && currentUserId !== 'guest') {
      void DJChanceMixConfigService.syncConfigFromServer(currentUserId).then((cloudCfg) => {
        setConfig(cloudCfg);
        engineRef.current.updateConfig(cloudCfg);
      });
    }
  }, [currentUserId]);

  // Hydrate catalog tracks & ChanceTEK One playlists
  const refreshCatalogAndPlaylists = useCallback(() => {
    const rawTracks = MusicCatalogService.getAllTracks();
    const sources = rawTracks.map(trackToDJSource);
    setCatalogTracks(sources);

    const mine =
      currentUserId !== 'guest'
        ? PlaylistService.getUserPlaylists(currentUserId, currentEmail)
        : [];
    const pub = PlaylistService.getPublicPlaylists({ sortBy: 'recent' });
    const dedup = new Map<string, Playlist>();
    for (const pl of [...mine, ...pub]) {
      dedup.set(pl.id, pl);
    }
    setPlaylists(Array.from(dedup.values()));
    return { sources, playlistsMap: dedup };
  }, [currentUserId, currentEmail]);

  useEffect(() => {
    const { sources, playlistsMap } = refreshCatalogAndPlaylists();
    void PlaylistService.syncFromServer(false);

    const unsubCat = MusicCatalogService.subscribe(() => refreshCatalogAndPlaylists());
    const unsubPl = PlaylistService.subscribe(() => refreshCatalogAndPlaylists());

    // Initial queue setup from ?playlist=<id> or Studio Catalog
    if (initialPlaylistParam && playlistsMap.has(initialPlaylistParam)) {
      const pl = playlistsMap.get(initialPlaylistParam)!;
      const plTracks = playlistToDJSources(pl);
      setActivePlaylistId(pl.id);
      setActivePlaylistName(pl.name);
      setQueue(plTracks.length > 0 ? plTracks : sources.slice(0, 16));
      const plSet = DJChanceMixConfigService.getPlaylistSettings(pl.id, configRef.current.defaultMode);
      setPlaylistMixSettings(plSet);
      if (!plSet.autoMixEnabled) {
        engineRef.current.setMode('original');
      } else {
        engineRef.current.setMode(plSet.mixingMode);
      }
    } else if (sources.length > 0) {
      setQueue(sources.slice(0, 18));
      setActivePlaylistName('ChanceTEK Studio Mix');
    }

    return () => {
      unsubCat();
      unsubPl();
    };
  }, [initialPlaylistParam, refreshCatalogAndPlaylists]);

  // Resolve next track honoring manual override, shuffle-aware transition planning, and repeat
  const resolveUpcomingTrack = useCallback(
    (fromIndex?: number, excludeId?: string): DJTrackSource | null => {
      const q = queueRef.current;
      if (q.length === 0) return null;

      if (overrideNextRef.current && overrideNextRef.current.id !== excludeId) {
        return overrideNextRef.current;
      }

      const idx = typeof fromIndex === 'number' ? fromIndex : currentIndexRef.current;
      const activeTrack = q[idx] || null;

      if (shuffleRef.current && q.length > 1) {
        const unplayed = q.filter(
          (t) => t.id !== (excludeId || activeTrack?.id) && !playedHistoryRef.current.has(t.id)
        );
        const pool =
          unplayed.length > 0
            ? unplayed
            : repeatRef.current
            ? q.filter((t) => t.id !== (excludeId || activeTrack?.id))
            : [];
        if (pool.length === 0) return null;
        if (activeTrack && configRef.current.defaultMode !== 'original') {
          return pickSmartShuffleNext(activeTrack, pool, analysesRef.current, configRef.current);
        }
        return pool[Math.floor(Math.random() * pool.length)];
      }

      const nextIdx = idx + 1;
      if (nextIdx < q.length) return q[nextIdx];
      if (repeatRef.current && q.length > 1) return q[0];
      return null;
    },
    []
  );

  // Subscribe to DualDeckMixerEngine
  useEffect(() => {
    const engine = engineRef.current;
    engine.setCallbacks({
      onRequestNextTrack: () => {
        const activeId = engine.getSnapshot().decks[engine.getSnapshot().activeDeck].track?.id;
        return resolveUpcomingTrack(currentIndexRef.current, activeId);
      },
      onTrackAdvanced: (newTrack) => {
        playedHistoryRef.current.add(newTrack.id);
        if (overrideNextRef.current?.id === newTrack.id) {
          setOverrideNextTrack(null);
        }
        const newIdx = queueRef.current.findIndex((t) => t.id === newTrack.id);
        if (newIdx >= 0) {
          setCurrentIndex(newIdx);
        }
      },
      onBeforePlayExternalPause: () => {
        try {
          pauseGlobalPlayer();
        } catch {}
      },
    });

    const unsub = engine.subscribe((snap) => {
      setSnapshot(snap);
      // Merge newly completed deck analyses into React state for Queue compatibility badges
      const deckA = snap.decks.A;
      const deckB = snap.decks.B;
      if (deckA.track && deckA.analysis && !analysesRef.current[deckA.track.id]) {
        setAnalyses((prev) => ({ ...prev, [deckA.track!.id]: deckA.analysis! }));
      }
      if (deckB.track && deckB.analysis && !analysesRef.current[deckB.track.id]) {
        setAnalyses((prev) => ({ ...prev, [deckB.track!.id]: deckB.analysis! }));
      }
    });

    return () => {
      unsub();
    };
  }, [pauseGlobalPlayer, resolveUpcomingTrack]);

  // Background lookahead analyzer: gently pre-analyzes up to 6 tracks around currentIndex
  useEffect(() => {
    if (queue.length === 0) return;
    let cancelled = false;
    const windowTracks = queue.slice(Math.max(0, currentIndex), Math.min(queue.length, currentIndex + 6));

    (async () => {
      for (const track of windowTracks) {
        if (cancelled) break;
        if (analysesRef.current[track.id]?.analysisStatus === 'ready') continue;
        const result = await TrackAnalyzerService.analyzeTrack(track, {
          targetLufs: configRef.current.targetLufs,
          silenceSensitivity: configRef.current.silenceSensitivity,
        });
        if (!cancelled) {
          setAnalyses((prev) => ({ ...prev, [track.id]: result }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queue, currentIndex]);

  // Sync first two tracks onto Deck A / Deck B cleanly when queue loads and decks are empty
  useEffect(() => {
    if (queue.length === 0) return;
    const engine = engineRef.current;
    const snap = engine.getSnapshot();
    const activeDeckSnap = snap.decks[snap.activeDeck];
    if (!activeDeckSnap.track && queue[0]) {
      void engine.loadTrackOnDeck(snap.activeDeck, queue[0], { autoplay: false });
      if (queue[1]) {
        void engine.preloadNextTrack(queue[1]);
      }
    }
  }, [queue]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleUpdateConfig = useCallback(
    (partial: Partial<MixConfiguration>) => {
      setConfig((prev) => {
        const next = { ...prev, ...partial };
        engineRef.current.updateConfig(next);
        void DJChanceMixConfigService.saveConfig(next, currentUserId !== 'guest' ? currentUserId : undefined);
        return next;
      });
    },
    [currentUserId]
  );

  const handleResetConfig = useCallback(() => {
    const fresh = { ...DEFAULT_MIX_CONFIGURATION };
    setConfig(fresh);
    engineRef.current.updateConfig(fresh);
    void DJChanceMixConfigService.saveConfig(fresh, currentUserId !== 'guest' ? currentUserId : undefined);
    notify('Audio engineering settings restored to ChanceTEK defaults.');
  }, [currentUserId, notify]);

  const handleSelectMode = useCallback(
    (mode: MixMode) => {
      handleUpdateConfig({ defaultMode: mode });
      engineRef.current.setMode(mode);
      if (activePlaylistId && playlistMixSettings) {
        const updated = DJChanceMixConfigService.savePlaylistSettings(
          {
            ...playlistMixSettings,
            autoMixEnabled: mode !== 'original',
            mixingMode: mode,
          },
          currentUserId !== 'guest' ? currentUserId : undefined
        );
        setPlaylistMixSettings(updated);
      }
      notify(`Mixing Mode switched to ${MIX_MODE_META[mode].label} — active seamlessly.`);
    },
    [activePlaylistId, playlistMixSettings, currentUserId, handleUpdateConfig, notify]
  );

  const handlePlayTrackAt = useCallback(
    async (index: number) => {
      const target = queue[index];
      if (!target) return;
      setCurrentIndex(index);
      playedHistoryRef.current.add(target.id);
      if (overrideNextTrack?.id === target.id) setOverrideNextTrack(null);

      const upcoming = resolveUpcomingTrack(index, target.id);
      await engineRef.current.playTrack(target, upcoming);
    },
    [queue, overrideNextTrack, resolveUpcomingTrack]
  );

  const handlePlayPauseMain = useCallback(async () => {
    const activeDeck = snapshot.decks[snapshot.activeDeck];
    if (!activeDeck.track && queue.length > 0) {
      await handlePlayTrackAt(currentIndex);
      return;
    }
    await engineRef.current.togglePlay();
  }, [snapshot, queue, currentIndex, handlePlayTrackAt]);

  const handleSkipNext = useCallback(async () => {
    const upcoming = resolveUpcomingTrack(currentIndex, snapshot.decks[snapshot.activeDeck].track?.id);
    if (!upcoming) return;
    const idx = queue.findIndex((t) => t.id === upcoming.id);
    await handlePlayTrackAt(idx >= 0 ? idx : 0);
  }, [resolveUpcomingTrack, currentIndex, snapshot, queue, handlePlayTrackAt]);

  const handleSkipPrev = useCallback(async () => {
    const activeDeck = snapshot.decks[snapshot.activeDeck];
    if (activeDeck.currentTime > 4) {
      engineRef.current.seekDeck(snapshot.activeDeck, 0);
      return;
    }
    if (queue.length === 0) return;
    const prevIdx = currentIndex > 0 ? currentIndex - 1 : repeatPlaylist ? queue.length - 1 : 0;
    await handlePlayTrackAt(prevIdx);
  }, [snapshot, queue, currentIndex, repeatPlaylist, handlePlayTrackAt]);

  const handleCueNextTrack = useCallback(
    (track: DJTrackSource) => {
      setOverrideNextTrack(track);
      void engineRef.current.preloadNextTrack(track);
      notify(`Cued "${track.title}" as next transition track on Deck ${snapshot.nextDeck}.`);
    },
    [snapshot.nextDeck, notify]
  );

  const handleSelectPlaylist = useCallback(
    (playlistId: string) => {
      const pl = playlists.find((p) => p.id === playlistId);
      if (!pl) return;
      const tracks = playlistToDJSources(pl);
      setActivePlaylistId(pl.id);
      setActivePlaylistName(pl.name);
      setQueue(tracks);
      setCurrentIndex(0);
      setOverrideNextTrack(null);
      playedHistoryRef.current.clear();

      const plSet = DJChanceMixConfigService.getPlaylistSettings(pl.id, config.defaultMode);
      setPlaylistMixSettings(plSet);
      const effectiveMode = plSet.autoMixEnabled ? plSet.mixingMode : 'original';
      engineRef.current.setMode(effectiveMode);

      if (tracks[0]) {
        void engineRef.current.loadTrackOnDeck(snapshot.activeDeck, tracks[0], { autoplay: false });
        void engineRef.current.preloadNextTrack(tracks[1] || null);
      }
      notify(`Loaded playlist "${pl.name}" (${tracks.length} music tracks).`);
    },
    [playlists, config.defaultMode, snapshot.activeDeck, notify]
  );

  const handleSelectAllCatalog = useCallback(() => {
    const list = catalogTracks.slice(0, 24);
    setActivePlaylistId(null);
    setActivePlaylistName('ChanceTEK Studio Mix');
    setPlaylistMixSettings(null);
    setQueue(list);
    setCurrentIndex(0);
    setOverrideNextTrack(null);
    playedHistoryRef.current.clear();
    if (list[0]) {
      void engineRef.current.loadTrackOnDeck(snapshot.activeDeck, list[0], { autoplay: false });
      void engineRef.current.preloadNextTrack(list[1] || null);
    }
  }, [catalogTracks, snapshot.activeDeck]);

  const handleTogglePlaylistAutoMix = useCallback(
    (enabled: boolean) => {
      if (!activePlaylistId || !playlistMixSettings) return;
      const nextMode: MixMode = enabled
        ? playlistMixSettings.mixingMode === 'original'
          ? 'automix'
          : playlistMixSettings.mixingMode
        : 'original';
      const updated = DJChanceMixConfigService.savePlaylistSettings(
        { ...playlistMixSettings, autoMixEnabled: enabled, mixingMode: nextMode },
        currentUserId !== 'guest' ? currentUserId : undefined
      );
      setPlaylistMixSettings(updated);
      engineRef.current.setMode(nextMode);
      notify(enabled ? `AutoMix enabled for "${activePlaylistName}".` : `AutoMix disabled for "${activePlaylistName}" (Original Playback).`);
    },
    [activePlaylistId, playlistMixSettings, currentUserId, activePlaylistName, notify]
  );

  const handleOptimizeDjFlow = useCallback(() => {
    if (queue.length < 3) return;
    const activeId = snapshot.decks[snapshot.activeDeck].track?.id || queue[currentIndex]?.id;
    const { orderedTracks, avgCompatibility } = optimizePlaylistFlow(
      queue,
      analyses,
      config,
      activeId
    );
    setQueue(orderedTracks);
    setCurrentIndex(0);
    setOverrideNextTrack(null);
    if (orderedTracks[1]) {
      void engineRef.current.preloadNextTrack(orderedTracks[1]);
    }
    notify(`AI DJ Flow sequenced ${orderedTracks.length} tracks (${avgCompatibility}% avg harmonic & BPM compatibility).`);
  }, [queue, snapshot, currentIndex, analyses, config, notify]);

  const handleMoveTrack = useCallback(
    (index: number, direction: 'up' | 'down') => {
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= queue.length) return;
      const copy = [...queue];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIdx, 0, moved);
      setQueue(copy);

      // Persist reorder if managing a ChanceTEK One playlist
      if (activePlaylistId && currentUserId !== 'guest') {
        const pl = playlists.find((p) => p.id === activePlaylistId);
        if (pl && PlaylistService.canUserModifyPlaylist(pl, currentUserId, isAdmin, currentEmail)) {
          const itemIds = copy
            .map((t) => pl.items.find((it) => it.mediaId === t.id)?.id)
            .filter((id): id is string => Boolean(id));
          if (itemIds.length === pl.items.length) {
            PlaylistService.reorderPlaylistItems(pl.id, currentUserId, itemIds, isAdmin, currentEmail);
          }
        }
      }

      const activeId = snapshot.decks[snapshot.activeDeck].track?.id;
      const newCurIdx = activeId ? copy.findIndex((t) => t.id === activeId) : currentIndex;
      if (newCurIdx >= 0) {
        setCurrentIndex(newCurIdx);
        if (copy[newCurIdx + 1]) {
          void engineRef.current.preloadNextTrack(copy[newCurIdx + 1]);
        }
      }
    },
    [queue, activePlaylistId, currentUserId, playlists, isAdmin, currentEmail, snapshot, currentIndex]
  );

  const handleRemoveTrack = useCallback(
    (index: number) => {
      const removed = queue[index];
      const nextQueue = queue.filter((_, i) => i !== index);
      setQueue(nextQueue);
      if (activePlaylistId && removed && currentUserId !== 'guest') {
        const pl = playlists.find((p) => p.id === activePlaylistId);
        if (pl && PlaylistService.canUserModifyPlaylist(pl, currentUserId, isAdmin, currentEmail)) {
          const plItem = pl.items.find((it) => it.mediaId === removed.id);
          if (plItem) {
            PlaylistService.removeItemFromPlaylist(pl.id, currentUserId, plItem.id, isAdmin, currentEmail);
          }
        }
      }
      if (index < currentIndex) {
        setCurrentIndex((c) => Math.max(0, c - 1));
      }
    },
    [queue, activePlaylistId, currentUserId, playlists, isAdmin, currentEmail, currentIndex]
  );

  const handleAddCatalogTrack = useCallback(
    (track: DJTrackSource) => {
      if (queue.some((t) => t.id === track.id)) {
        notify(`"${track.title}" is already in the mix queue.`);
        return;
      }
      const nextQueue = [...queue, track];
      setQueue(nextQueue);
      if (activePlaylistId && currentUserId !== 'guest') {
        const pl = playlists.find((p) => p.id === activePlaylistId);
        if (pl && PlaylistService.canUserModifyPlaylist(pl, currentUserId, isAdmin, currentEmail)) {
          PlaylistService.addItemToPlaylist(
            pl.id,
            currentUserId,
            {
              mediaId: track.id,
              mediaType: 'music',
              title: track.title,
              artistName: track.artistName,
              coverUrl: track.coverUrl,
              duration: track.duration,
              audioUrl: track.audioUrl,
              genre: track.genre,
            },
            isAdmin,
            currentEmail
          );
        }
      }
      if (!snapshot.decks[snapshot.nextDeck].track) {
        void engineRef.current.preloadNextTrack(track);
      }
      notify(`Added "${track.title}" to DJChanceMix queue.`);
    },
    [queue, activePlaylistId, currentUserId, playlists, isAdmin, currentEmail, snapshot, notify]
  );

  const handleImportLocalFiles = useCallback(
    (files: FileList) => {
      const { imported, rejected } = importAuthorizedLocalAudioFiles(files);
      if (imported.length > 0) {
        setQueue((prev) => [...prev, ...imported]);
        if (!snapshot.decks[snapshot.activeDeck].track) {
          void engineRef.current.loadTrackOnDeck(snapshot.activeDeck, imported[0], { autoplay: false });
        } else if (!snapshot.decks[snapshot.nextDeck].track) {
          void engineRef.current.preloadNextTrack(imported[0]);
        }
      }
      if (rejected.length > 0) {
        setImportNotice(
          `Imported ${imported.length} authorized audio file(s). Skipped ${rejected.length}: ${rejected[0].reason}`
        );
      } else if (imported.length > 0) {
        setImportNotice(
          `Imported ${imported.length} local audio file(s) privately in browser memory (never uploaded to third-party servers).`
        );
      }
    },
    [snapshot]
  );

  const handleCreateOrSavePlaylist = useCallback(
    (name: string, includeCurrentQueue: boolean) => {
      if (currentUserId === 'guest') {
        notify('Sign in to save DJChanceMix playlists to your ChanceTEK One Library.');
        return;
      }
      const initialItems = includeCurrentQueue
        ? queue
            .filter((t) => t.sourceType !== 'local-file')
            .map((t) => ({
              mediaId: t.id,
              mediaType: 'music' as const,
              title: t.title,
              artistName: t.artistName,
              coverUrl: t.coverUrl,
              duration: t.duration,
              audioUrl: t.audioUrl,
              genre: t.genre,
            }))
        : [];
      const created = PlaylistService.createPlaylist({
        ownerId: currentUserId,
        ownerName: profile?.name || user?.displayName || 'ChanceTEK One Member',
        ownerEmail: currentEmail,
        ownerAvatarUrl: profile?.avatarUrl,
        name,
        description: `Mixed in DJChanceMix (${MIX_MODE_META[config.defaultMode].label})`,
        type: 'music',
        visibility: 'private',
        initialItems,
      });
      refreshCatalogAndPlaylists();
      setActivePlaylistId(created.id);
      setActivePlaylistName(created.name);
      if (!includeCurrentQueue) setQueue([]);
      notify(`Saved playlist "${created.name}" (${created.itemCount} tracks).`);
    },
    [currentUserId, profile, currentEmail, queue, config.defaultMode, refreshCatalogAndPlaylists, notify]
  );

  const handleRenamePlaylist = useCallback(
    (newName: string) => {
      if (!activePlaylistId || currentUserId === 'guest') return;
      const res = PlaylistService.updatePlaylist(
        activePlaylistId,
        currentUserId,
        { name: newName },
        isAdmin,
        currentEmail
      );
      if (res.success) {
        setActivePlaylistName(newName);
        refreshCatalogAndPlaylists();
        notify(`Renamed playlist to "${newName}".`);
      }
    },
    [activePlaylistId, currentUserId, isAdmin, currentEmail, refreshCatalogAndPlaylists, notify]
  );

  const handleDeletePlaylist = useCallback(() => {
    if (!activePlaylistId || currentUserId === 'guest') return;
    const res = PlaylistService.deletePlaylist(activePlaylistId, currentUserId, isAdmin, currentEmail);
    if (res.success) {
      notify(`Deleted playlist "${activePlaylistName}".`);
      refreshCatalogAndPlaylists();
      handleSelectAllCatalog();
    }
  }, [activePlaylistId, currentUserId, isAdmin, currentEmail, activePlaylistName, notify, refreshCatalogAndPlaylists, handleSelectAllCatalog]);

  const canManageActivePlaylist = useMemo(() => {
    if (!activePlaylistId || currentUserId === 'guest') return false;
    const pl = playlists.find((p) => p.id === activePlaylistId);
    return Boolean(pl && PlaylistService.canUserModifyPlaylist(pl, currentUserId, isAdmin, currentEmail));
  }, [activePlaylistId, currentUserId, playlists, isAdmin, currentEmail]);

  const activeDeck = snapshot.decks[snapshot.activeDeck];
  const nextDeck = snapshot.decks[snapshot.nextDeck];
  const activePlan = snapshot.activeTransitionPlan;
  const progressPct =
    activeDeck.duration > 0 ? Math.min(100, (activeDeck.currentTime / activeDeck.duration) * 100) : 0;
  const mixOutPct =
    activePlan && activeDeck.duration > 0
      ? Math.min(100, (activePlan.mixOutSec / activeDeck.duration) * 100)
      : null;

  return (
    <div className="space-y-6 py-4 sm:py-6">
      {/* Live Feedback Toast */}
      {statusToast && (
        <div className="fixed top-20 right-4 sm:right-6 z-50 max-w-md px-4 py-3 rounded-2xl bg-[#110c22]/95 border border-brand-gold/50 text-white text-xs font-bold shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3">
          <Sparkles className="w-4 h-4 text-brand-gold shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* 1. DJChanceMix Hero Header */}
      <header className="relative overflow-hidden rounded-3xl p-5 sm:p-7 bg-gradient-to-br from-[#170e2e] via-[#0b0a16] to-[#08121f] border border-brand-purple/35 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/15 border border-brand-gold/40 text-brand-gold text-[10px] font-black uppercase tracking-widest">
                <Disc3 className={`w-3.5 h-3.5 ${snapshot.isPlaying ? 'animate-spin-slow' : ''}`} />
                <span>ChanceTEK Innovation</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-[10px] font-mono font-bold">
                <Activity className="w-3 h-3" />
                <span>{snapshot.webAudioActive ? 'Web Audio 32-Bit DSP' : 'Dual-Deck Engine Ready'}</span>
              </span>
              {config.normalizationEnabled && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-300 text-[10px] font-mono">
                  <ShieldCheck className="w-3 h-3 text-brand-gold" />
                  <span>{config.targetLufs} LUFS · True-Peak Safe</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              DJ<span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-gold via-amber-300 to-cyan-300">ChanceMix</span>
            </h1>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-2xl">
              <span className="text-brand-gold font-semibold">Let the music flow.</span> Real-time BPM beat matching, Camelot harmonic mixing, vocal-aware transition points, and studio loudness normalization — engineered directly into ChanceTEK One.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowConsole((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-extrabold border transition-all cursor-pointer ${
                showConsole
                  ? 'bg-brand-gold/15 border-brand-gold/50 text-brand-gold'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>DJ Console</span>
              {showConsole ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-extrabold border transition-all cursor-pointer ${
                showSettings
                  ? 'bg-brand-purple/30 border-brand-neon text-white'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-brand-gold" />
              <span>Mix Settings</span>
            </button>
          </div>
        </div>

        {/* 2. 6-Mode Mixing Selector Bar */}
        <div className="mt-5 pt-4 border-t border-white/10 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {MIX_MODES.map((m) => {
              const meta = MIX_MODE_META[m];
              const isSelected = snapshot.mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSelectMode(m)}
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-br from-brand-gold/20 via-brand-purple/25 to-transparent border-brand-gold text-white shadow-[0_0_20px_rgba(245,195,68,0.18)]'
                      : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/10 text-neutral-300'
                  }`}
                >
                  <p className={`text-xs font-extrabold ${isSelected ? 'text-brand-gold' : 'text-white'}`}>
                    {meta.label}
                  </p>
                  <p className="text-[10px] text-neutral-400 truncate mt-0.5">{meta.tagline}</p>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-neutral-400">
            <span className="text-brand-gold font-bold">{MIX_MODE_META[snapshot.mode].label}:</span>{' '}
            {MIX_MODE_META[snapshot.mode].description}
          </p>
        </div>
      </header>

      {/* 3. Main Now Playing + Next Up Transition Card */}
      <section className="rounded-3xl p-5 sm:p-6 bg-[#0a0a14]/95 border border-white/10 shadow-xl space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Now Playing (Left 7 cols) */}
          <div className="lg:col-span-7 flex items-center gap-4 min-w-0">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-brand-gold/40 shrink-0 bg-neutral-900 shadow-2xl">
              {activeDeck.track ? (
                <Image
                  src={activeDeck.track.coverUrl || '/images/studio_cover.jpg'}
                  alt={activeDeck.track.title}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Disc3 className="w-9 h-9 text-neutral-600" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-gold">
                  Now Playing · Deck {snapshot.activeDeck}
                </span>
                {snapshot.transitionPhase === 'mixing' && (
                  <span className="px-2 py-0.5 rounded-full bg-brand-gold text-black text-[10px] font-black uppercase animate-pulse">
                    Mixing Live · {Math.round(snapshot.transitionProgress * 100)}%
                  </span>
                )}
                {snapshot.transitionPhase === 'armed' && snapshot.secondsUntilTransition !== null && (
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-[10px] font-mono font-bold">
                    Next Mix in {formatSec(snapshot.secondsUntilTransition)}
                  </span>
                )}
              </div>

              <h2 className="text-lg sm:text-2xl font-black text-white truncate">
                {activeDeck.track?.title || 'Select a playlist or press Play'}
              </h2>
              <p className="text-xs sm:text-sm text-neutral-300 truncate">
                {activeDeck.track?.artistName || 'ChanceTEK One Catalog'}
                {activeDeck.track?.albumTitle ? ` · ${activeDeck.track.albumTitle}` : ''}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] font-mono">
                <span className="px-2.5 py-0.5 rounded-lg bg-brand-gold/15 border border-brand-gold/30 text-brand-gold font-bold">
                  {activeDeck.effectiveBpm || activeDeck.analysis?.bpm || '--'} BPM
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-brand-purple/25 border border-brand-purple/40 text-white font-bold">
                  {activeDeck.analysis?.camelotCode || '--'} ({activeDeck.analysis?.musicalKey || 'Analyzing'})
                </span>
                {activeDeck.analysis && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-neutral-300">
                    Energy {activeDeck.analysis.energyScore}/100 · {activeDeck.analysis.integratedLufs} LUFS
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Upcoming Next Track & Transition Preview (Right 5 cols) */}
          <div className="lg:col-span-5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
              <span className="text-cyan-300 flex items-center gap-1.5">
                <Music2 className="w-3.5 h-3.5" />
                <span>Up Next · Deck {snapshot.nextDeck}</span>
              </span>
              {activePlan && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-mono">
                  {activePlan.compatibilityScore}% Match
                </span>
              )}
            </div>

            {nextDeck.track ? (
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-cyan-400/35 shrink-0 bg-neutral-900">
                  <Image
                    src={nextDeck.track.coverUrl || '/images/studio_cover.jpg'}
                    alt={nextDeck.track.title}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-bold text-white truncate">{nextDeck.track.title}</p>
                  <p className="text-[11px] text-neutral-400 truncate">
                    {nextDeck.track.artistName} · {nextDeck.analysis?.bpm || nextDeck.track.bpm || '--'} BPM ·{' '}
                    {nextDeck.analysis?.camelotCode || '…'}
                  </p>
                  {activePlan && (
                    <p className="text-[10px] text-brand-gold font-semibold capitalize truncate mt-0.5">
                      {activePlan.transitionType.replace(/-/g, ' ')} ({activePlan.transitionDurationSec}s
                      {activePlan.beatSyncEnabled ? ' · BeatSync' : ''})
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-400">End of queue — enable Repeat or add tracks below.</p>
            )}
          </div>
        </div>

        {/* Scrubber Bar with Mix-Out Indicator */}
        <div className="space-y-1.5">
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
              if (activeDeck.duration > 0) {
                engineRef.current.seekDeck(snapshot.activeDeck, ratio * activeDeck.duration);
              }
            }}
            className="relative h-2.5 rounded-full bg-white/10 overflow-hidden cursor-pointer group"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-purple via-brand-gold to-amber-300 transition-all duration-75"
              style={{ width: `${progressPct}%` }}
            />
            {mixOutPct !== null && snapshot.mode !== 'original' && (
              <div
                className="absolute top-0 bottom-0 w-1 bg-cyan-300 shadow-[0_0_8px_#22d3ee]"
                style={{ left: `${mixOutPct}%` }}
                title="AI Mix-Out Point"
              />
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
            <span>{formatSec(activeDeck.currentTime)}</span>
            <span className="text-neutral-500">
              {activePlan && snapshot.mode !== 'original'
                ? `Mix-Out at ${formatSec(activePlan.mixOutSec)}`
                : activePlaylistName}
            </span>
            <span>{formatSec(activeDeck.duration)}</span>
          </div>
        </div>

        {/* Transport & Master Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsShuffled((s) => !s);
                notify(!isShuffled ? 'Shuffle enabled — AI evaluates compatible next tracks before mixing.' : 'Shuffle disabled.');
              }}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isShuffled
                  ? 'bg-brand-purple/30 border-brand-gold text-brand-gold'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-400 hover:text-white'
              }`}
              title="Smart Shuffle (Evaluates harmonic & BPM transitions before mixing)"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setRepeatPlaylist((r) => !r)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                repeatPlaylist
                  ? 'bg-brand-purple/30 border-brand-gold text-brand-gold'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-400 hover:text-white'
              }`}
              title="Repeat Playlist"
            >
              <Repeat className="w-4 h-4" />
            </button>
          </div>

          {/* Center Transport */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSkipPrev()}
              className="p-3 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white transition-all cursor-pointer"
              aria-label="Previous track"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => void handlePlayPauseMain()}
              className="w-14 h-14 rounded-full bg-gradient-to-r from-brand-gold via-amber-400 to-amber-500 text-black flex items-center justify-center shadow-[0_0_30px_rgba(245,195,68,0.45)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
              aria-label={snapshot.isPlaying ? 'Pause DJChanceMix' : 'Play DJChanceMix'}
            >
              {snapshot.isPlaying ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void handleSkipNext()}
              className="p-3 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white transition-all cursor-pointer"
              aria-label="Next track"
            >
              <SkipForward className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => void engineRef.current.triggerTransitionNow()}
              disabled={!nextDeck.track || snapshot.transitionPhase === 'mixing'}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 text-xs font-extrabold transition-all disabled:opacity-35 cursor-pointer"
              title="Execute AI transition into Deck B immediately"
            >
              <Zap className="w-3.5 h-3.5 text-brand-gold fill-current" />
              <span>Mix Now</span>
            </button>
          </div>

          {/* Master Volume */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => engineRef.current.toggleMute()}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white cursor-pointer"
              aria-label={snapshot.isMuted ? 'Unmute' : 'Mute'}
            >
              {snapshot.isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={snapshot.isMuted ? 0 : snapshot.masterVolume}
              onChange={(e) => engineRef.current.setMasterVolume(parseFloat(e.target.value))}
              className="w-24 sm:w-28 accent-brand-gold cursor-pointer"
              aria-label="Master Volume"
            />
          </div>
        </div>
      </section>

      {/* 4. Optional Expanded Dual-Deck DJ Mixing Console */}
      {showConsole && (
        <DualDeckConsole
          snapshot={snapshot}
          config={config}
          onSeekDeck={(deckId: DeckId, sec: number) => engineRef.current.seekDeck(deckId, sec)}
          onTempoChange={(deckId: DeckId, rate: number) => engineRef.current.setDeckTempoRate(deckId, rate)}
          onDeckVolumeChange={(deckId: DeckId, vol: number) => engineRef.current.setDeckVolume(deckId, vol)}
          onCrossfaderChange={(pos: number) => engineRef.current.setCrossfader(pos)}
          onTriggerMixNow={() => void engineRef.current.triggerTransitionNow()}
        />
      )}

      {/* 5. Collapsible Advanced Audio Engineering Settings */}
      {showSettings && (
        <MixSettingsPanel
          config={config}
          onChange={handleUpdateConfig}
          onReset={handleResetConfig}
        />
      )}

      {/* 6. Playlist & Intelligent Mix Queue Panel */}
      <MixQueuePanel
        playlists={playlists}
        activePlaylistId={activePlaylistId}
        activePlaylistName={activePlaylistName}
        canManageActivePlaylist={canManageActivePlaylist}
        playlistMixSettings={playlistMixSettings}
        queue={queue}
        activeTrackId={activeDeck.track?.id || null}
        nextTrackId={nextDeck.track?.id || null}
        analyses={analyses}
        config={config}
        catalogTracks={catalogTracks}
        onSelectPlaylist={handleSelectPlaylist}
        onSelectAllCatalog={handleSelectAllCatalog}
        onTogglePlaylistAutoMix={handleTogglePlaylistAutoMix}
        onCreatePlaylist={(name) => handleCreateOrSavePlaylist(name, false)}
        onRenamePlaylist={handleRenamePlaylist}
        onDeletePlaylist={handleDeletePlaylist}
        onSaveQueueAsPlaylist={(name) => handleCreateOrSavePlaylist(name, true)}
        onOptimizeDjFlow={handleOptimizeDjFlow}
        onPlayTrackAt={(idx) => void handlePlayTrackAt(idx)}
        onCueNextTrack={handleCueNextTrack}
        onMoveTrack={handleMoveTrack}
        onRemoveTrack={handleRemoveTrack}
        onAddCatalogTrack={handleAddCatalogTrack}
        onImportLocalFiles={handleImportLocalFiles}
        importNotice={importNotice}
      />
    </div>
  );
};

