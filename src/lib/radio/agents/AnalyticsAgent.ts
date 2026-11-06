// ============================================================
// Agent 6: Analytics Agent
// Telemetry collection for radio playback, DJ events, and rotation.
// Integrates with the existing AnalyticsEngine.
// ============================================================

import { RadioSong, RadioStationId } from '@/types/radio';

export interface RadioTelemetryEvent {
  type:
    | 'RADIO_STATION_STARTED'
    | 'RADIO_SONG_PLAYED'
    | 'RADIO_DJ_INTRO'
    | 'RADIO_TRACK_SKIPPED'
    | 'RADIO_ORCHESTRATOR_ROTATION'
    | 'RADIO_UPLOAD';
  stationId?: RadioStationId;
  songId?: string;
  songTitle?: string;
  artist?: string;
  duration?: number;
  playedFor?: number;      // seconds
  djIntroScript?: string;
  queueDepth?: number;
  catalogSize?: number;
  timestamp: number;
  sessionId: string;
}

const SESSION_KEY = '8osw_radio_session';

function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `rsn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export class AnalyticsAgent {
  private static events: RadioTelemetryEvent[] = [];

  static trackStationStart(stationId: RadioStationId) {
    this.push({ type: 'RADIO_STATION_STARTED', stationId });
  }

  static trackSongPlay(
    stationId: RadioStationId,
    song: RadioSong,
    playedForSeconds?: number
  ) {
    this.push({
      type: 'RADIO_SONG_PLAYED',
      stationId,
      songId: song.id,
      songTitle: song.title,
      artist: song.artist,
      duration: song.duration,
      playedFor: playedForSeconds,
    });
  }

  static trackDjIntro(stationId: RadioStationId, script: string) {
    this.push({ type: 'RADIO_DJ_INTRO', stationId, djIntroScript: script });
  }

  static trackSkip(stationId: RadioStationId, song: RadioSong, playedForSeconds: number) {
    this.push({
      type: 'RADIO_TRACK_SKIPPED',
      stationId,
      songId: song.id,
      songTitle: song.title,
      playedFor: playedForSeconds,
    });
  }

  static trackRotation(stationId: RadioStationId, queueDepth: number, catalogSize: number) {
    this.push({
      type: 'RADIO_ORCHESTRATOR_ROTATION',
      stationId,
      queueDepth,
      catalogSize,
    });
  }

  static trackUpload(song: Partial<RadioSong>) {
    this.push({
      type: 'RADIO_UPLOAD',
      songId: song.id,
      songTitle: song.title,
      artist: song.artist,
    });
  }

  static getEvents(): RadioTelemetryEvent[] {
    return [...this.events];
  }

  static getStationEvents(stationId: RadioStationId): RadioTelemetryEvent[] {
    return this.events.filter((e) => e.stationId === stationId);
  }

  private static push(partial: Omit<RadioTelemetryEvent, 'timestamp' | 'sessionId'>) {
    const event: RadioTelemetryEvent = {
      ...partial,
      timestamp: Date.now(),
      sessionId: getSessionId(),
    };
    this.events.push(event);

    // Write to console in dev for real-time visibility
    if (process.env.NODE_ENV === 'development') {
      console.log(`[RadioAnalytics] ${event.type}`, event);
    }
  }
}
