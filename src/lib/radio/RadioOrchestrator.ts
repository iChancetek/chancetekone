// ============================================================
// Radio Orchestrator — ChanceTEKone
// Central coordinator for all 6 AI radio agents.
// Manages dual-station lifecycle, queue automation, and telemetry.
// ============================================================

import {
  RadioSong,
  RadioStation,
  RadioStationId,
  RadioStationState,
  RadioQueueItem,
  RadioOrchestratorState,
  RadioAgentState,
} from '@/types/radio';
import { RADIO_STATIONS, RADIO_INITIAL_CATALOG } from './initialCatalog';
import { MusicIngestionAgent } from './agents/MusicIngestionAgent';
import { MusicIntelligenceAgent } from './agents/MusicIntelligenceAgent';
import { ProgrammingAgent } from './agents/ProgrammingAgent';
import { AIDjAgent, STATION_ID_EVERY_N_SONGS } from './agents/AIDjAgent';
import { BroadcastAgent } from './agents/BroadcastAgent';
import { AnalyticsAgent } from './agents/AnalyticsAgent';

// ----- Singleton Orchestrator -----

class RadioOrchestrator {
  private catalog: RadioSong[] = [];
  private broadcasters: Partial<Record<RadioStationId, BroadcastAgent>> = {};
  private stationStates: Partial<Record<RadioStationId, RadioStationState>> = {};
  private agentStates: Record<string, RadioAgentState> = {};
  private listeners: Set<(state: RadioOrchestratorState) => void> = new Set();
  private initialized = false;
  private activeStation: RadioStationId | null = null;

  // ── Playback Session Guards ───────────────────────────────
  // Each station gets a monotonically-increasing session ID.
  // When tuneIn/tuneOut/skip is called, the ID is incremented.
  // Any async playNext() that was started before the increment
  // detects the stale ID and aborts — preventing overlapping audio.
  private playbackSessionIds: Partial<Record<RadioStationId, number>> = {};
  // Per-station flag so only one playNext() executes at a time.
  private playNextInProgress: Partial<Record<RadioStationId, boolean>> = {};
  // Per-station song completion counter for station ID bump scheduling.
  private songsPlayedCount: Partial<Record<RadioStationId, number>> = {};
  // Optional hook: called when radio starts so the catalog player can pause.
  private pauseCatalogPlayer?: () => void;

  /** Register a callback that pauses the catalog music player when radio starts. */
  setPauseCatalogPlayer(fn: () => void) {
    this.pauseCatalogPlayer = fn;
  }

  // ── Initialization ────────────────────────────────────────

  initialize() {
    if (this.initialized) return;

    // Enrich catalog with musical intelligence
    this.setAgent('ingestion', 'running', 'Loading catalog…');
    this.catalog = RADIO_INITIAL_CATALOG.map((s) =>
      MusicIntelligenceAgent.enrichSong(s)
    );
    this.setAgent('ingestion', 'idle', `${this.catalog.length} tracks ready`);
    this.setAgent('intelligence', 'idle', `Analyzed ${this.catalog.length} tracks`);

    // Initialize state for each station
    for (const station of RADIO_STATIONS) {
      const eligible = ProgrammingAgent.getEligibleSongs({
        stationId: station.id,
        catalog: this.catalog,
        recentlyPlayed: [],
        currentQueue: [],
      });
      const queue = ProgrammingAgent.buildQueue({
        stationId: station.id,
        catalog: this.catalog,
        recentlyPlayed: [],
        currentQueue: [],
      });
      this.stationStates[station.id] = {
        station,
        currentItem: null,
        upNext: queue,
        recentlyPlayed: [],
        playbackState: 'idle',
        currentTime: 0,
        currentDuration: 0,
      };
      this.broadcasters[station.id] = new BroadcastAgent();
    }

    this.setAgent('programming', 'idle', 'Queues built for all stations');
    this.setAgent('dj', 'idle', 'Ready');
    this.setAgent('broadcast', 'idle', 'Standby');
    this.setAgent('analytics', 'idle', 'Session active');

    this.initialized = true;
    this.emit();
  }

  // ── Playback Control ──────────────────────────────────────

  async tuneIn(stationId: RadioStationId): Promise<void> {
    if (!this.initialized) this.initialize();
    if (this.activeStation && this.activeStation !== stationId) {
      this.tuneOut(this.activeStation);
    }
    this.activeStation = stationId;

    // Invalidate any in-flight playNext() for this station before starting fresh
    this.playbackSessionIds[stationId] = (this.playbackSessionIds[stationId] ?? 0) + 1;
    this.playNextInProgress[stationId] = false;
    // Reset song counter so welcome fires on the very first track
    this.songsPlayedCount[stationId] = 0;

    // Pause catalog music player when radio starts
    this.pauseCatalogPlayer?.();

    AnalyticsAgent.trackStationStart(stationId);
    this.setAgent('broadcast', 'running', `Broadcasting ${stationId}`);
    this.updateState(stationId, { playbackState: 'playing' });
    await this.playNext(stationId, true);
  }

  tuneOut(stationId: RadioStationId) {
    // Invalidate any in-flight playNext() so it aborts after its async DJ intro
    this.playbackSessionIds[stationId] = (this.playbackSessionIds[stationId] ?? 0) + 1;
    this.playNextInProgress[stationId] = false;
    this.broadcasters[stationId]?.stop();
    this.updateState(stationId, { playbackState: 'idle', currentItem: null });
    if (this.activeStation === stationId) this.activeStation = null;
    this.setAgent('broadcast', 'idle', 'Standby');
    this.emit();
  }

  pause(stationId: RadioStationId) {
    this.broadcasters[stationId]?.pause();
    this.updateState(stationId, { playbackState: 'idle' });
    this.emit();
  }

  resume(stationId: RadioStationId) {
    this.broadcasters[stationId]?.resume();
    this.updateState(stationId, { playbackState: 'playing' });
    this.emit();
  }

  skip(stationId: RadioStationId) {
    const state = this.stationStates[stationId];
    if (!state) return;
    const current = state.currentItem?.song;
    const broadcaster = this.broadcasters[stationId];
    if (current && broadcaster) {
      AnalyticsAgent.trackSkip(stationId, current, broadcaster.getCurrentTime());
    }
    // Invalidate in-flight playNext() before stopping and re-advancing
    this.playbackSessionIds[stationId] = (this.playbackSessionIds[stationId] ?? 0) + 1;
    this.playNextInProgress[stationId] = false;
    this.broadcasters[stationId]?.stop();
    this.playNext(stationId, false);
  }

  setVolume(stationId: RadioStationId, volume: number) {
    this.broadcasters[stationId]?.setVolume(volume);
  }

  // ── Queue Playback ────────────────────────────────────────

  private async playNext(stationId: RadioStationId, isFirstSong = false) {
    // ── Single-flight guard ───────────────────────────────────
    // Prevent multiple concurrent playNext() calls for the same station.
    // This can happen if an onComplete/onError callback races with a new tuneIn.
    if (this.playNextInProgress[stationId]) return;
    this.playNextInProgress[stationId] = true;

    // Capture the session ID at the start of this invocation.
    // If tuneIn/tuneOut/skip increments it before we finish the async DJ fetch,
    // the stale call detects it and aborts without touching audio.
    const sessionId = this.playbackSessionIds[stationId] ?? 0;

    const state = this.stationStates[stationId];
    if (!state) { this.playNextInProgress[stationId] = false; return; }

    // Refill queue if low
    if (state.upNext.length < 3) {
      this.refillQueue(stationId);
    }

    const item = state.upNext.shift();
    if (!item) {
      this.updateState(stationId, { playbackState: 'idle' });
      this.emit();
      this.playNextInProgress[stationId] = false;
      return;
    }

    // Generate DJ intro (async — may take time; session could change underneath)
    // On first song: guaranteed welcome greeting.
    // Every STATION_ID_EVERY_N_SONGS songs (after first): station ID bump.
    // Otherwise: normal probabilistic intro.
    const playCount = this.songsPlayedCount[stationId] ?? 0;
    const isBumpSong = !isFirstSong && playCount > 0 && playCount % STATION_ID_EVERY_N_SONGS === 0;
    const enrichedItem = await this.generateDjIntro(stationId, item, state, isFirstSong, isBumpSong);
    // Increment count after deciding intro type for this song
    this.songsPlayedCount[stationId] = playCount + 1;

    // ── Stale-session abort ───────────────────────────────────
    // If tuneOut/skip/tuneIn was called while we awaited the DJ intro,
    // our session ID is now outdated — abort to prevent overlapping audio.
    if ((this.playbackSessionIds[stationId] ?? 0) !== sessionId) {
      this.playNextInProgress[stationId] = false;
      return;
    }

    this.updateState(stationId, {
      currentItem: enrichedItem,
      upNext: state.upNext,
      playbackState: enrichedItem.hasIntro ? 'dj-intro' : 'playing',
    });
    this.emit();

    const broadcaster = this.broadcasters[stationId];
    if (!broadcaster) { this.playNextInProgress[stationId] = false; return; }

    // Clear in-progress flag just before handing control to the broadcaster
    // so that the onComplete / onError callbacks can re-enter cleanly.
    this.playNextInProgress[stationId] = false;

    // Subscribe for time updates to propagate to UI
    const unsubscribeTime = broadcaster.subscribe((event) => {
      if (event.type === 'TIME_UPDATE') {
        this.updateState(stationId, {
          currentTime: event.currentTime,
          currentDuration: event.duration,
        });
        this.emit();
      }
    });

    await broadcaster.playItem(
      enrichedItem,
      () => {
        // Track completed — verify session is still current before advancing
        unsubscribeTime();
        if ((this.playbackSessionIds[stationId] ?? 0) !== sessionId) return;
        const current = enrichedItem.song;
        AnalyticsAgent.trackSongPlay(stationId, current, broadcaster.getCurrentTime());
        const currentState = this.stationStates[stationId];
        if (currentState) {
          const played = [current, ...currentState.recentlyPlayed].slice(0, 20);
          this.catalog = this.catalog.map((s) =>
            s.id === current.id ? { ...s, totalPlays: s.totalPlays + 1, lastPlayedAt: new Date().toISOString() } : s
          );
          this.updateState(stationId, { recentlyPlayed: played });
        }
        this.playNext(stationId, false);
      },
      () => {
        // Error — verify session before advancing
        unsubscribeTime();
        if ((this.playbackSessionIds[stationId] ?? 0) !== sessionId) return;
        console.warn(`[Orchestrator] Track error on ${stationId}, advancing.`);
        this.playNext(stationId, false);
      }
    );
  }

  private async generateDjIntro(
    stationId: RadioStationId,
    item: RadioQueueItem,
    state: RadioStationState,
    isFirstSong = false,
    isStationBump = false
  ): Promise<RadioQueueItem> {
    const station = state.station;
    const previousSong = state.recentlyPlayed[0] ?? null;

    // ── Determine which script to generate ────────────────────
    let scriptResult;
    if (isFirstSong) {
      // Guaranteed welcome greeting — always plays on Tune In
      scriptResult = AIDjAgent.generateWelcomeScript(station);
    } else if (isStationBump) {
      // Periodic station ID reminder — plays every N songs
      scriptResult = AIDjAgent.generateStationBump(station);
    } else {
      // Normal probabilistic DJ intro (10% chance)
      scriptResult = AIDjAgent.generateIntroScript(station, item.song, previousSong, false);
    }

    if (!scriptResult.shouldSpeak) return { ...item, hasIntro: false };

    // Try to generate TTS via server API
    try {
      const resp = await fetch('/api/radio/dj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId,
          script: scriptResult.script,
          upcomingSongId: item.song.id,
          previousSongId: previousSong?.id,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        this.setAgent('dj', 'idle', `Generated intro for "${item.song.title}"`);
        AnalyticsAgent.trackDjIntro(stationId, scriptResult.script);
        return {
          ...item,
          hasIntro: true,
          djIntroScript: scriptResult.script,
          djIntroAudioUrl: data.audioUrl ?? undefined,
        };
      }
    } catch {
      // Server unavailable — silently fall back to no intro, music never stops
    }
    return { ...item, hasIntro: false };
  }

  private refillQueue(stationId: RadioStationId) {
    const state = this.stationStates[stationId];
    if (!state) return;
    const newQueue = ProgrammingAgent.buildQueue({
      stationId,
      catalog: this.catalog,
      recentlyPlayed: state.recentlyPlayed,
      currentQueue: state.upNext,
    });
    this.updateState(stationId, { upNext: newQueue });
    AnalyticsAgent.trackRotation(stationId, newQueue.length, this.catalog.length);
    this.setAgent('programming', 'idle', `Queue depth: ${newQueue.length}`);
  }

  // ── Catalog Management (Admin) ────────────────────────────

  addSong(song: RadioSong) {
    const enriched = MusicIntelligenceAgent.enrichSong(song);
    this.catalog = [...this.catalog, enriched];
    AnalyticsAgent.trackUpload(enriched);

    // Insert into active station queues if applicable
    for (const stationId of song.stations) {
      const state = this.stationStates[stationId];
      if (state) {
        const updatedQueue = ProgrammingAgent.insertNewSong(state.upNext, enriched);
        this.updateState(stationId, { upNext: updatedQueue });
      }
    }
    this.emit();
  }

  updateSong(id: string, updates: Partial<RadioSong>) {
    this.catalog = this.catalog.map((s) => (s.id === id ? { ...s, ...updates } : s));
    this.emit();
  }

  removeSong(id: string) {
    this.catalog = this.catalog.filter((s) => s.id !== id);
    this.emit();
  }

  getCatalog(): RadioSong[] {
    return this.catalog;
  }

  // ── State & Subscription ──────────────────────────────────

  subscribe(listener: (state: RadioOrchestratorState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  getState(): RadioOrchestratorState {
    const stations: Partial<Record<RadioStationId, RadioStationState>> = {};
    for (const st of RADIO_STATIONS) {
      stations[st.id] = this.stationStates[st.id] ?? {
        station: st,
        currentItem: null,
        upNext: [],
        recentlyPlayed: [],
        playbackState: 'idle',
        currentTime: 0,
        currentDuration: 0,
      };
    }
    return {
      stations: stations as Record<RadioStationId, RadioStationState>,
      catalog: this.catalog,
      agents: this.agentStates,
      initialized: this.initialized,
    };
  }

  getActiveStation(): RadioStationId | null {
    return this.activeStation;
  }

  // ── Internal Helpers ──────────────────────────────────────

  private updateState(stationId: RadioStationId, updates: Partial<RadioStationState>) {
    const existing = this.stationStates[stationId];
    if (!existing) return;
    this.stationStates[stationId] = { ...existing, ...updates };
  }

  private setAgent(
    name: string,
    status: RadioAgentState['status'],
    detail: string
  ) {
    this.agentStates[name] = {
      name,
      status,
      lastActivity: new Date().toISOString(),
      detail,
    };
  }

  private emit() {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }
}

// Export singleton — one Orchestrator for the entire app lifetime
export const radioOrchestrator = new RadioOrchestrator();
