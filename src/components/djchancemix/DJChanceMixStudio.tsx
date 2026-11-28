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
  FolderPlus,
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
  getRegisteredLocalAudioTracks,
  importAuthorizedLocalAudioFiles,
  playlistToDJSources,
  trackToDJSource,
} from '@/lib/djchancemix/audioSourceProvider';
import { TrackAnalyzerService } from '@/lib/djchancemix/analyzerService';
import {
  optimizePlaylistFlow,
  pickSmartShuffleNext,
} from '@/lib/djchancemix/transitionIntelligence';
import { evaluateCamelotCompatibility } from '@/lib/djchancemix/dsp/keyDetector';
import { getSharedDJMixerEngine } from '@/lib/djchancemix/dualDeckEngine';
import { DJChanceMixConfigService } from '@/lib/djchancemix/configService';
import { CreatePlaylistModal } from '@/components/playlist/CreatePlaylistModal';
import { EditPlaylistModal } from '@/components/playlist/EditPlaylistModal';
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
  const { profile, user } = useAuth();
  const { pause: pauseGlobalPlayer } = usePlayer();
  const currentUserId = profile?.id || user?.uid || 'guest';
  const currentEmail = (profile?.email || user?.email || '').toLowerCase().trim() || undefined;

  const engineRef = useRef(getSharedDJMixerEngine());
  const [snapshot, setSnapshot] = useState<MixerEngineSnapshot>(() =>
    engineRef.current.getSnapshot()
  );
  const [config, setConfig] = useState<MixConfiguration>(() =>
    DJChanceMixConfigService.loadLocalConfig()
  );
  const [showConsole, setShowConsole] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [editModalState, setEditModalState] = useState<{
    open: boolean;
    tab: 'songs' | 'view' | 'details';
  }>({ open: false, tab: 'songs' });

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
  const hasInitializedQueueRef = useRef<boolean>(false);
  const hydratedInitialParamRef = useRef<string | null>(null);

  queueRef.current = queue;
  currentIndexRef.current = currentIndex;
  shuffleRef.current = isShuffled;
  repeatRef.current = repeatPlaylist;
  overrideNextRef.current = overrideNextTrack;
  analysesRef.current = analyses;
  configRef.current = config;

  const notify = useCallback((msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast((cur) => (cur === msg ? null : cur)), 3800);
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
    const hydrateFromLatest = () => {
      const { sources, playlistsMap } = refreshCatalogAndPlaylists();

      if (
        initialPlaylistParam &&
        hydratedInitialParamRef.current !== initialPlaylistParam &&
        playlistsMap.has(initialPlaylistParam)
      ) {
        const pl = playlistsMap.get(initialPlaylistParam)!;
        const plTracks = playlistToDJSources(pl);
        hydratedInitialParamRef.current = initialPlaylistParam;
        hasInitializedQueueRef.current = true;
        setActivePlaylistId(pl.id);
        setActivePlaylistName(pl.name);
        const nextQueue = plTracks.length > 0 ? plTracks : sources.slice(0, 16);
        queueRef.current = nextQueue;
        setQueue(nextQueue);
        const plSet = DJChanceMixConfigService.getPlaylistSettings(pl.id, configRef.current.defaultMode);
        setPlaylistMixSettings(plSet);
        engineRef.current.setMode(plSet.autoMixEnabled ? plSet.mixingMode : 'original');
        return;
      }

      if (!hasInitializedQueueRef.current && queueRef.current.length === 0 && sources.length > 0) {
        hasInitializedQueueRef.current = true;
        const initialList = sources.slice(0, 18);
        queueRef.current = initialList;
        setQueue(initialList);
        setActivePlaylistName('ChanceTEK Studio Mix');
      }
    };

    hydrateFromLatest();
    void PlaylistService.syncFromServer(false).then(() => hydrateFromLatest());

    const unsubCat = MusicCatalogService.subscribe(() => hydrateFromLatest());
    const unsubPl = PlaylistService.subscribe(() => hydrateFromLatest());

    return () => {
      unsubCat();
      unsubPl();
    };
  }, [initialPlaylistParam, refreshCatalogAndPlaylists]);

  /**
   * Resolves the NEXT DISTINCT track in the playlist/queue.
   * GUARANTEES:
   * - Anchors on the actual playing track's real index in `queueRef.current` (immune to async React state delay!)
   * - Walks sequentially through ALL tracks (0 -> 1 -> 2 -> ... -> N-1, then loops to 0 if Repeat is ON)
   * - NEVER automatically returns the exact same track currently playing on the active deck!
   */
  const resolveUpcomingTrack = useCallback(
    (fromIndex?: number, currentActiveTrackId?: string): DJTrackSource | null => {
      const q = queueRef.current;
      if (q.length === 0) return null;

      if (overrideNextRef.current && overrideNextRef.current.id !== currentActiveTrackId) {
        return overrideNextRef.current;
      }

      // Anchor strictly on the real active track's position in queue
      let anchorIdx = typeof fromIndex === 'number' ? fromIndex : currentIndexRef.current;
      if (currentActiveTrackId) {
        const exactIdx = q.findIndex((t) => t.id === currentActiveTrackId);
        if (exactIdx >= 0) anchorIdx = exactIdx;
      }
      const activeTrack = q[anchorIdx] || null;
      const excludeId = currentActiveTrackId || activeTrack?.id;

      // Shuffle-aware intelligent selection
      if (shuffleRef.current && q.length > 1) {
        const unplayed = q.filter(
          (t) => t.id !== excludeId && !playedHistoryRef.current.has(t.id)
        );
        const pool =
          unplayed.length > 0
            ? unplayed
            : repeatRef.current
              ? q.filter((t) => t.id !== excludeId)
              : [];
        if (pool.length === 0) return null;
        if (activeTrack && configRef.current.defaultMode !== 'original') {
          return pickSmartShuffleNext(activeTrack, pool, analysesRef.current, configRef.current);
        }
        return pool[Math.floor(Math.random() * pool.length)];
      }

      // Harmonic Mix: among the next 3 songs, bring the most key-compatible one forward (session queue only)
      if (configRef.current.defaultMode === 'harmonic' && anchorIdx >= 0 && anchorIdx < q.length - 2) {
        const activeAnalysis = activeTrack ? analysesRef.current[activeTrack.id] : undefined;
        if (activeAnalysis && (activeAnalysis.keyConfidence ?? 0) >= 0.3) {
          let bestIdx = -1;
          let bestScore = -1;
          let immediateScore = -1;
          for (let i = anchorIdx + 1; i <= Math.min(q.length - 1, anchorIdx + 3); i++) {
            if (q[i].id === excludeId) continue;
            const cand = analysesRef.current[q[i].id];
            if (!cand || (cand.keyConfidence ?? 0) < 0.3) continue;
            const score = evaluateCamelotCompatibility(activeAnalysis.camelotCode, cand.camelotCode).score;
            if (i === anchorIdx + 1) immediateScore = score;
            if (score > bestScore) {
              bestScore = score;
              bestIdx = i;
            }
          }
          if (bestIdx > anchorIdx + 1 && bestScore >= immediateScore + 10) {
            const reordered = [...q];
            const [picked] = reordered.splice(bestIdx, 1);
            reordered.splice(anchorIdx + 1, 0, picked);
            queueRef.current = reordered;
            setQueue(reordered);
            return picked;
          }
        }
      }

      // Sequential full-playlist progression skipping any duplicate of the active track
      for (let step = 1; step < q.length; step++) {
        const candidateIdx = anchorIdx + step;
        if (candidateIdx < q.length) {
          if (q[candidateIdx].id !== excludeId) return q[candidateIdx];
        } else if (repeatRef.current) {
          const wrappedIdx = candidateIdx % q.length;
          if (q[wrappedIdx].id !== excludeId) return q[wrappedIdx];
        } else {
          return null;
        }
      }
      return null;
    },
    []
  );

  // Subscribe to DualDeckMixerEngine with SYNCHRONOUS queue advancement!
  useEffect(() => {
    const engine = engineRef.current;
    engine.setCallbacks({
      onRequestNextTrack: (activeId) => {
        const resolvedActiveId =
          activeId || engine.getSnapshot().decks[engine.getSnapshot().activeDeck].track?.id;
        return resolveUpcomingTrack(currentIndexRef.current, resolvedActiveId);
      },
      onTrackAdvanced: (newTrack) => {
        playedHistoryRef.current.add(newTrack.id);
        if (overrideNextRef.current?.id === newTrack.id) {
          overrideNextRef.current = null;
          setOverrideNextTrack(null);
        }
        const newIdx = queueRef.current.findIndex((t) => t.id === newTrack.id);
        if (newIdx >= 0) {
          // CRITICAL: Update ref synchronously BEFORE engine immediately invokes onRequestNextTrack!
          currentIndexRef.current = newIdx;
          setCurrentIndex(newIdx);
        }
      },
      onBeforePlayExternalPause: () => {
        try {
          pauseGlobalPlayer();
        } catch { }
      },
    });

    const unsub = engine.subscribe((snap) => {
      setSnapshot(snap);
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

  // Background lookahead analyzer: gently pre-analyzes up to 6 tracks ahead so transitions stay seamless
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

  // Load initial two DISTINCT songs onto Deck A / Deck B when decks are empty
  useEffect(() => {
    if (queue.length === 0) return;
    const engine = engineRef.current;
    const snap = engine.getSnapshot();
    const activeDeckSnap = snap.decks[snap.activeDeck];
    if (!activeDeckSnap.track && queue[0]) {
      void engine.loadTrackOnDeck(snap.activeDeck, queue[0], { autoplay: false });
      const distinctSecond = queue.find((t, idx) => idx > 0 && t.id !== queue[0].id) || null;
      void engine.preloadNextTrack(distinctSecond, { allowDuplicateOfActive: false });
    }
  }, [queue]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleUpdateConfig = useCallback(
    (partial: Partial<MixConfiguration>) => {
      setConfig((prev) => {
        // Never let a settings change silently revert the live mixing mode (playlists can set the engine mode directly)
        const next = {
          ...prev,
          ...partial,
          defaultMode: partial.defaultMode ?? engineRef.current.getConfig().defaultMode,
        };
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
      const livePlan = engineRef.current.getSnapshot().activeTransitionPlan;
      const behavior: Record<MixMode, string> = {
        automix: 'AI picks beat-match, phrase, harmonic or vocal-safe blends per song pair.',
        'smart-crossfade': 'Pure volume crossfade at the natural outro — tempo never changes.',
        beatsync: 'Next song is tempo-locked to this BPM, dropped on the downbeat with a bass swap.',
        harmonic: 'Long blends for compatible Camelot keys, tight cuts on key clashes; next song chosen by key.',
        continuous: 'Silence trimmed on both sides and songs spliced with a 0.6s micro-fade — zero dead air.',
        original: 'Every song plays start-to-finish, unmodified: no crossfade, tempo change or loudness gain.',
      };
      const planNote =
        livePlan && mode !== 'original'
          ? ` Next: ${livePlan.transitionType.replace(/-/g, ' ')} · ${livePlan.transitionDurationSec}s${livePlan.beatSyncEnabled
            ? ` · BeatSync ${livePlan.tempoAdjustmentPercent > 0 ? '+' : ''}${livePlan.tempoAdjustmentPercent}%`
            : ''
          }.`
          : '';
      notify(`${MIX_MODE_META[mode].label}: ${behavior[mode]}${planNote}`);
    },
    [activePlaylistId, playlistMixSettings, currentUserId, handleUpdateConfig, notify]
  );

  const handlePlayTrackAt = useCallback(
    async (index: number, customQueue?: DJTrackSource[]) => {
      const q = customQueue || queueRef.current;
      const target = q[index];
      if (!target) return;
      currentIndexRef.current = index;
      setCurrentIndex(index);
      playedHistoryRef.current.add(target.id);
      if (overrideNextRef.current?.id === target.id) {
        overrideNextRef.current = null;
        setOverrideNextTrack(null);
      }

      const upcoming = resolveUpcomingTrack(index, target.id);
      await engineRef.current.playTrack(target, upcoming);
    },
    [resolveUpcomingTrack]
  );

  /**
   * 1-Click "Mix Playlist Now": loads any playlist (or Studio Mix), activates AutoMix if needed,
   * starts Track 1 immediately, preloads Track 2 (distinct!), and mixes the ENTIRE playlist end-to-end!
   */
  const handleMixPlaylistNow = useCallback(
    async (playlistId: string | null) => {
      let targetTracks: DJTrackSource[] = [];
      let targetName = 'ChanceTEK Studio Mix';

      if (playlistId === null) {
        targetTracks = activePlaylistId === null && queueRef.current.length > 0
          ? queueRef.current
          : catalogTracks.slice(0, 24);
        setActivePlaylistId(null);
        setActivePlaylistName(targetName);
        setPlaylistMixSettings(null);
      } else {
        const pl = playlists.find((p) => p.id === playlistId);
        if (!pl) return;
        targetTracks = playlistToDJSources(pl);
        targetName = pl.name;
        setActivePlaylistId(pl.id);
        setActivePlaylistName(pl.name);
        const plSet = DJChanceMixConfigService.getPlaylistSettings(pl.id, configRef.current.defaultMode);
        setPlaylistMixSettings(plSet);
        if (plSet.autoMixEnabled) {
          engineRef.current.setMode(plSet.mixingMode === 'original' ? 'automix' : plSet.mixingMode);
        }
      }

      if (targetTracks.length === 0) {
        notify(`"${targetName}" has no music tracks yet — add songs to start mixing!`);
        return;
      }

      // Ensure AutoMix is active when user clicks "Mix Playlist Now"
      if (engineRef.current.getConfig().defaultMode === 'original') {
        engineRef.current.setMode('automix');
        setConfig((prev) => ({ ...prev, defaultMode: 'automix' }));
      }

      queueRef.current = targetTracks;
      currentIndexRef.current = 0;
      overrideNextRef.current = null;
      playedHistoryRef.current.clear();

      setQueue(targetTracks);
      setCurrentIndex(0);
      setOverrideNextTrack(null);

      await handlePlayTrackAt(0, targetTracks);
      notify(`Mixing "${targetName}" live (${targetTracks.length} songs queued continuously)!`);
    },
    [activePlaylistId, catalogTracks, playlists, handlePlayTrackAt, notify]
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
    const activeId = snapshot.decks[snapshot.activeDeck].track?.id;
    const upcoming = resolveUpcomingTrack(currentIndexRef.current, activeId);
    if (!upcoming) return;
    const idx = queueRef.current.findIndex((t) => t.id === upcoming.id);
    await handlePlayTrackAt(idx >= 0 ? idx : 0);
  }, [resolveUpcomingTrack, snapshot, handlePlayTrackAt]);

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

  const handleManualLoadToDeck = useCallback(
    async (deckId: DeckId, track: DJTrackSource) => {
      await engineRef.current.manualLoadTrackToDeck(deckId, track, false);
      notify(`Manually loaded "${track.title}" onto Deck ${deckId}.`);
    },
    [notify]
  );

  const handleSyncDeckBpm = useCallback(
    (deckId: DeckId) => {
      const res = engineRef.current.syncDeckBpmToOther(deckId);
      notify(res.message);
    },
    [notify]
  );

  const handleCueNextTrack = useCallback(
    (track: DJTrackSource) => {
      overrideNextRef.current = track;
      setOverrideNextTrack(track);
      void engineRef.current.preloadNextTrack(track, { allowDuplicateOfActive: false });
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
      queueRef.current = tracks;
      currentIndexRef.current = 0;
      overrideNextRef.current = null;
      setQueue(tracks);
      setCurrentIndex(0);
      setOverrideNextTrack(null);
      playedHistoryRef.current.clear();

      const plSet = DJChanceMixConfigService.getPlaylistSettings(pl.id, config.defaultMode);
      setPlaylistMixSettings(plSet);
      engineRef.current.setMode(plSet.autoMixEnabled ? plSet.mixingMode : 'original');

      if (tracks[0]) {
        void engineRef.current.loadTrackOnDeck(snapshot.activeDeck, tracks[0], { autoplay: false });
        const second = tracks.find((t, idx) => idx > 0 && t.id !== tracks[0].id) || null;
        void engineRef.current.preloadNextTrack(second, { allowDuplicateOfActive: false });
      }
      notify(`Loaded "${pl.name}" (${tracks.length} songs). Click Play or Mix Playlist Now!`);
    },
    [playlists, config.defaultMode, snapshot.activeDeck, notify]
  );

  const handleSelectAllCatalog = useCallback(() => {
    const list = catalogTracks.slice(0, 24);
    setActivePlaylistId(null);
    setActivePlaylistName('ChanceTEK Studio Mix');
    setPlaylistMixSettings(null);
    queueRef.current = list;
    currentIndexRef.current = 0;
    overrideNextRef.current = null;
    setQueue(list);
    setCurrentIndex(0);
    setOverrideNextTrack(null);
    playedHistoryRef.current.clear();
    if (list[0]) {
      void engineRef.current.loadTrackOnDeck(snapshot.activeDeck, list[0], { autoplay: false });
      const second = list.find((t, idx) => idx > 0 && t.id !== list[0].id) || null;
      void engineRef.current.preloadNextTrack(second, { allowDuplicateOfActive: false });
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
      notify(
        enabled
          ? `AutoMix enabled for "${activePlaylistName}".`
          : `AutoMix disabled for "${activePlaylistName}" (Original Playback).`
      );
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
    queueRef.current = orderedTracks;
    currentIndexRef.current = 0;
    overrideNextRef.current = null;
    setQueue(orderedTracks);
    setCurrentIndex(0);
    setOverrideNextTrack(null);
    const second = orderedTracks.find((t, i) => i > 0 && t.id !== orderedTracks[0]?.id) || null;
    if (second) {
      void engineRef.current.preloadNextTrack(second, { allowDuplicateOfActive: false });
    }
    notify(`AI DJ Flow sequenced ${orderedTracks.length} songs (${avgCompatibility}% avg harmonic & BPM match).`);
  }, [queue, snapshot, currentIndex, analyses, config, notify]);

  const activePlaylistObject = useMemo(
    () => (activePlaylistId ? playlists.find((p) => p.id === activePlaylistId) || null : null),
    [activePlaylistId, playlists]
  );

  // STRICT OWNER-ONLY CHECK: only the owner of the playlist can make changes to the playlist!
  const canManageActivePlaylist = useMemo(() => {
    if (!activePlaylistObject || currentUserId === 'guest') return false;
    return PlaylistService.isPlaylistOwner(activePlaylistObject, currentUserId, currentEmail);
  }, [activePlaylistObject, currentUserId, currentEmail]);

  const handleMoveTrack = useCallback(
    (index: number, direction: 'up' | 'down') => {
      if (activePlaylistId && !canManageActivePlaylist) {
        notify('Only the playlist owner can rearrange songs in this playlist.');
        return;
      }
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= queue.length) return;
      const copy = [...queue];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIdx, 0, moved);
      queueRef.current = copy;
      setQueue(copy);

      if (activePlaylistObject && canManageActivePlaylist) {
        const itemIds = copy
          .map((t) => activePlaylistObject.items.find((it) => it.mediaId === t.id)?.id)
          .filter((id): id is string => Boolean(id));
        if (itemIds.length === activePlaylistObject.items.length) {
          PlaylistService.reorderPlaylistItems(
            activePlaylistObject.id,
            currentUserId,
            itemIds,
            false,
            currentEmail
          );
        }
      }

      const activeId = snapshot.decks[snapshot.activeDeck].track?.id;
      const newCurIdx = activeId ? copy.findIndex((t) => t.id === activeId) : currentIndex;
      if (newCurIdx >= 0) {
        currentIndexRef.current = newCurIdx;
        setCurrentIndex(newCurIdx);
        const upcoming = resolveUpcomingTrack(newCurIdx, activeId);
        void engineRef.current.preloadNextTrack(upcoming, { allowDuplicateOfActive: false });
      }
    },
    [
      activePlaylistId,
      canManageActivePlaylist,
      queue,
      activePlaylistObject,
      currentUserId,
      currentEmail,
      snapshot,
      currentIndex,
      resolveUpcomingTrack,
      notify,
    ]
  );

  const handleRemoveTrack = useCallback(
    (index: number) => {
      if (activePlaylistId && !canManageActivePlaylist) {
        notify('Only the playlist owner can delete songs from this playlist.');
        return;
      }
      const removed = queue[index];
      const nextQueue = queue.filter((_, i) => i !== index);
      queueRef.current = nextQueue;
      setQueue(nextQueue);
      if (activePlaylistObject && canManageActivePlaylist && removed) {
        const plItem = activePlaylistObject.items.find((it) => it.mediaId === removed.id);
        if (plItem) {
          PlaylistService.removeItemFromPlaylist(
            activePlaylistObject.id,
            currentUserId,
            plItem.id,
            false,
            currentEmail
          );
        }
      }
      if (index < currentIndex) {
        const nextIdx = Math.max(0, currentIndex - 1);
        currentIndexRef.current = nextIdx;
        setCurrentIndex(nextIdx);
      }
    },
    [activePlaylistId, canManageActivePlaylist, queue, activePlaylistObject, currentUserId, currentEmail, currentIndex, notify]
  );

  const handleAddCatalogTrack = useCallback(
    (track: DJTrackSource) => {
      if (activePlaylistId && !canManageActivePlaylist) {
        notify('Only the playlist owner can add songs to this playlist.');
        return;
      }
      if (queue.some((t) => t.id === track.id)) {
        notify(`"${track.title}" is already in the mix queue.`);
        return;
      }
      const nextQueue = [...queue, track];
      queueRef.current = nextQueue;
      setQueue(nextQueue);
      if (activePlaylistObject && canManageActivePlaylist) {
        PlaylistService.addItemToPlaylist(
          activePlaylistObject.id,
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
          false,
          currentEmail
        );
      }
      if (!snapshot.decks[snapshot.nextDeck].track) {
        void engineRef.current.preloadNextTrack(track, { allowDuplicateOfActive: false });
      }
      notify(`Added "${track.title}" to DJChanceMix queue.`);
    },
    [activePlaylistId, canManageActivePlaylist, queue, activePlaylistObject, currentUserId, currentEmail, snapshot, notify]
  );

  const handleImportLocalFiles = useCallback(
    (files: FileList) => {
      const { imported, rejected } = importAuthorizedLocalAudioFiles(files);
      if (imported.length > 0) {
        const merged = [...queueRef.current, ...imported];
        queueRef.current = merged;
        setQueue(merged);
        if (!snapshot.decks[snapshot.activeDeck].track) {
          void engineRef.current.loadTrackOnDeck(snapshot.activeDeck, imported[0], { autoplay: false });
        } else if (!snapshot.decks[snapshot.nextDeck].track) {
          void engineRef.current.preloadNextTrack(imported[0], { allowDuplicateOfActive: false });
        }
      }
      if (rejected.length > 0) {
        setImportNotice(
          `Imported ${imported.length} authorized audio file(s). Skipped ${rejected.length}: ${rejected[0].reason}`
        );
      } else if (imported.length > 0) {
        setImportNotice(
          `Imported ${imported.length} local audio file(s) privately in browser memory.`
        );
      }
    },
    [snapshot]
  );

  // Merge catalog + queue + local files for Manual Deck A/B Loader picker
  const allAvailableTracksForDecks = useMemo(() => {
    const map = new Map<string, DJTrackSource>();
    for (const t of [...queue, ...getRegisteredLocalAudioTracks(), ...catalogTracks]) {
      if (!map.has(t.id)) map.set(t.id, t);
    }
    return Array.from(map.values());
  }, [queue, catalogTracks]);

  const activeDeck = snapshot.decks[snapshot.activeDeck];
  const nextDeck = snapshot.decks[snapshot.nextDeck];
  const activePlan = snapshot.activeTransitionPlan;
  const progressPct =
    activeDeck.duration > 0 ? Math.min(100, (activeDeck.currentTime / activeDeck.duration) * 100) : 0;
  const mixOutPct =
    activePlan && activeDeck.duration > 0
      ? Math.min(100, (activePlan.mixOutSec / activeDeck.duration) * 100)
      : null;

  const activePosInQueue = activeDeck.track
    ? queue.findIndex((t) => t.id === activeDeck.track!.id)
    : -1;

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
              DJ
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-gold via-amber-300 to-cyan-300">
                ChanceMix
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-2xl">
              <span className="text-brand-gold font-semibold">Let the music flow.</span> Continuous full-playlist AI AutoMix, BPM beat-locking, Camelot harmonic mixing, Club DJ Filter sweep, and manual Deck A / Deck B control.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleMixPlaylistNow(activePlaylistId)}
              disabled={queue.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-brand-gold to-amber-500 text-black text-xs font-black uppercase tracking-wider shadow-[0_0_24px_rgba(245,195,68,0.4)] hover:scale-105 active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Mix Playlist Now</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCreatePlaylistModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-xs font-extrabold transition-all cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Create Playlist</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConsole((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold border transition-all cursor-pointer ${showConsole
                  ? 'bg-brand-gold/15 border-brand-gold/50 text-brand-gold'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Console</span>
              {showConsole ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold border transition-all cursor-pointer ${showSettings
                  ? 'bg-brand-purple/30 border-brand-neon text-white'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-brand-gold" />
              <span>Settings</span>
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
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${isSelected
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
          {/* Live Mode Behavior Panel: shows exactly what the selected mode will do on the NEXT transition */}
          <div className="p-3 rounded-2xl bg-black/30 border border-white/10 space-y-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <p className="text-[11px] text-neutral-300">
                <span className="text-brand-gold font-bold">{MIX_MODE_META[snapshot.mode].label}:</span>{' '}
                {MIX_MODE_META[snapshot.mode].description}
              </p>
              <button
                type="button"
                onClick={() => void engineRef.current.triggerTransitionNow()}
                disabled={!nextDeck.track || !activeDeck.track || snapshot.transitionPhase === 'mixing'}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-gold/15 hover:bg-brand-gold/25 border border-brand-gold/40 text-brand-gold text-[11px] font-extrabold transition-all disabled:opacity-35 cursor-pointer"
                title="Hear this mode's transition into the cued song right now"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Preview {MIX_MODE_META[snapshot.mode].shortLabel} Transition</span>
              </button>
            </div>
            {snapshot.mode === 'original' ? (
              <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-neutral-300">No crossfade</span>
                <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-neutral-300">Tempo 1.00x</span>
                <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-neutral-300">No loudness gain</span>
                <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-neutral-300">Plays to the final second</span>
              </div>
            ) : activePlan ? (
              <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded-lg bg-brand-gold/15 border border-brand-gold/30 text-brand-gold font-bold capitalize">
                  {activePlan.transitionType.replace(/-/g, ' ')}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-neutral-200">
                  {activePlan.transitionDurationSec}s blend
                </span>
                <span
                  className={`px-2 py-0.5 rounded-lg border ${activePlan.beatSyncEnabled
                      ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                      : 'bg-white/5 border-white/10 text-neutral-400'
                    }`}
                >
                  {activePlan.beatSyncEnabled
                    ? `BeatSync ${activePlan.tempoAdjustmentPercent > 0 ? '+' : ''}${activePlan.tempoAdjustmentPercent}%${activePlan.mode === 'beatsync' ? ' · held' : ''
                    }`
                    : 'Natural tempo'}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-neutral-300">
                  {activePlan.crossfadeCurve} curve
                </span>
                {activePlan.eqSweepEnabled && (
                  <span className="px-2 py-0.5 rounded-lg bg-brand-purple/25 border border-brand-purple/50 text-brand-neon">
                    Bass swap
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-neutral-300">
                  Mix-out {formatSec(activePlan.mixOutSec)} · Cue-in {formatSec(activePlan.cueInSec)}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-neutral-300">
                  Key {activePlan.harmonicRelation === 'unknown' ? 'verifying' : `${activePlan.keyCompatibility}%`}
                </span>
              </div>
            ) : (
              <p className="text-[10px] text-neutral-500">
                Load a song on both decks (or start a playlist) to see this mode&apos;s live transition plan.
              </p>
            )}
            {activePlan && snapshot.mode !== 'original' && activePlan.warnings.length > 0 && (
              <p className="text-[10px] text-amber-300/90">{activePlan.warnings[0]}</p>
            )}
          </div>
        </div>
      </header>

      {/* 3. Main Now Playing + Next Up Transition Card */}
      <section className="rounded-3xl p-5 sm:p-6 bg-[#0a0a14]/95 border border-white/10 shadow-xl space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Now Playing */}
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
                  {activePosInQueue >= 0 ? ` · Track ${activePosInQueue + 1} of ${queue.length}` : ''}
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
                {activeDeck.track?.title || 'Select a playlist or press Mix Playlist Now'}
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

          {/* Upcoming Next Track Preview */}
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
              <p className="text-xs text-neutral-400">
                Add at least 2 tracks or manually click &ldquo;Load {snapshot.nextDeck}&rdquo; to mix decks.
              </p>
            )}
          </div>
        </div>

        {/* Scrubber Bar */}
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
                ? `AutoMix Transition at ${formatSec(activePlan.mixOutSec)}`
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
                const nextShuffle = !isShuffled;
                shuffleRef.current = nextShuffle;
                setIsShuffled(nextShuffle);
                notify(
                  nextShuffle
                    ? 'Smart Shuffle ON — AI selects compatible next tracks before mixing.'
                    : 'Sequential playlist mixing restored.'
                );
              }}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${isShuffled
                  ? 'bg-brand-purple/30 border-brand-gold text-brand-gold'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-400 hover:text-white'
                }`}
              title="Smart Shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                const nextRep = !repeatPlaylist;
                repeatRef.current = nextRep;
                setRepeatPlaylist(nextRep);
              }}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${repeatPlaylist
                  ? 'bg-brand-purple/30 border-brand-gold text-brand-gold'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-400 hover:text-white'
                }`}
              title="Repeat Entire Playlist Continuously"
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
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 text-xs font-extrabold transition-all disabled:opacity-35 cursor-pointer"
              title="Execute AI transition into standby deck immediately"
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

      {/* 4. Pro Dual-Deck DJ Mixing Console */}
      {showConsole && (
        <DualDeckConsole
          snapshot={snapshot}
          config={config}
          availableTracks={allAvailableTracksForDecks}
          onSeekDeck={(deckId: DeckId, sec: number) => engineRef.current.seekDeck(deckId, sec)}
          onTempoChange={(deckId: DeckId, rate: number) => engineRef.current.setDeckTempoRate(deckId, rate)}
          onDeckVolumeChange={(deckId: DeckId, vol: number) => engineRef.current.setDeckVolume(deckId, vol)}
          onToggleDeckPlay={(deckId: DeckId) => void engineRef.current.toggleDeckPlay(deckId)}
          onSyncDeckBpm={handleSyncDeckBpm}
          onManualLoadDeck={(deckId: DeckId, track: DJTrackSource) => void handleManualLoadToDeck(deckId, track)}
          onCrossfaderChange={(pos: number) => engineRef.current.setCrossfader(pos)}
          onDjFilterChange={(amt: number) => engineRef.current.setDjFilter(amt)}
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
        activePlaylistOwnerName={activePlaylistObject?.ownerName}
        canManageActivePlaylist={canManageActivePlaylist}
        playlistMixSettings={playlistMixSettings}
        queue={queue}
        activeTrackId={activeDeck.track?.id || null}
        nextTrackId={nextDeck.track?.id || null}
        analyses={analyses}
        config={config}
        catalogTracks={catalogTracks}
        onSelectPlaylist={handleSelectPlaylist}
        onMixPlaylistNow={(plId) => void handleMixPlaylistNow(plId)}
        onSelectAllCatalog={handleSelectAllCatalog}
        onTogglePlaylistAutoMix={handleTogglePlaylistAutoMix}
        onOpenCreatePlaylistModal={() => setShowCreatePlaylistModal(true)}
        onOpenEditPlaylistModal={(tab) => setEditModalState({ open: true, tab })}
        onOptimizeDjFlow={handleOptimizeDjFlow}
        onPlayTrackAt={(idx) => void handlePlayTrackAt(idx)}
        onManualLoadToDeck={(deckId, track) => void handleManualLoadToDeck(deckId, track)}
        onCueNextTrack={handleCueNextTrack}
        onMoveTrack={handleMoveTrack}
        onRemoveTrack={handleRemoveTrack}
        onAddCatalogTrack={handleAddCatalogTrack}
        onImportLocalFiles={handleImportLocalFiles}
        importNotice={importNotice}
      />

      {/* Full Create Playlist Modal inside DJChanceMix */}
      {showCreatePlaylistModal && (
        <CreatePlaylistModal
          isOpen={showCreatePlaylistModal}
          onClose={() => setShowCreatePlaylistModal(false)}
          onCreated={(newPlaylist) => {
            setShowCreatePlaylistModal(false);
            refreshCatalogAndPlaylists();
            const plTracks = playlistToDJSources(newPlaylist);
            setActivePlaylistId(newPlaylist.id);
            setActivePlaylistName(newPlaylist.name);
            queueRef.current = plTracks;
            currentIndexRef.current = 0;
            setQueue(plTracks);
            setCurrentIndex(0);
            const plSet = DJChanceMixConfigService.getPlaylistSettings(
              newPlaylist.id,
              config.defaultMode
            );
            setPlaylistMixSettings(plSet);
            if (plTracks.length > 0) {
              void handlePlayTrackAt(0, plTracks);
              notify(`Created & now mixing "${newPlaylist.name}" (${plTracks.length} songs)!`);
            } else {
              notify(`Created playlist "${newPlaylist.name}" — add songs below to start mixing.`);
            }
          }}
        />
      )}

      {/* Full View / Edit Songs Modal inside DJChanceMix (strictly owner-only for edits) */}
      {editModalState.open && activePlaylistObject && (
        <EditPlaylistModal
          isOpen={editModalState.open}
          onClose={() => setEditModalState({ open: false, tab: 'songs' })}
          playlist={activePlaylistObject}
          initialTab={canManageActivePlaylist ? editModalState.tab : 'view'}
          onUpdated={(updated) => {
            refreshCatalogAndPlaylists();
            setActivePlaylistName(updated.name);
            const updatedTracks = playlistToDJSources(updated);
            queueRef.current = updatedTracks;
            setQueue(updatedTracks);
          }}
          onDeleted={() => {
            setEditModalState({ open: false, tab: 'songs' });
            refreshCatalogAndPlaylists();
            handleSelectAllCatalog();
          }}
        />
      )}
    </div>
  );
};
