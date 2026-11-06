// ============================================================
// Agent 5: Broadcast Agent
// Manages continuous radio playback for a single station.
// Coordinates DJ intro audio and song audio via HTML5 Audio.
// Prevents dead air by requesting replacements on failure.
// ============================================================

import { RadioQueueItem, RadioSong } from '@/types/radio';

export type BroadcastEvent =
  | { type: 'SONG_STARTED'; song: RadioSong }
  | { type: 'DJ_INTRO_STARTED'; script: string }
  | { type: 'DJ_INTRO_ENDED' }
  | { type: 'SONG_ENDED'; song: RadioSong }
  | { type: 'TRACK_ERROR'; song: RadioSong }
  | { type: 'QUEUE_EXHAUSTED' }
  | { type: 'TIME_UPDATE'; currentTime: number; duration: number };

export type BroadcastListener = (event: BroadcastEvent) => void;

export class BroadcastAgent {
  private audio: HTMLAudioElement | null = null;
  private djAudio: HTMLAudioElement | null = null;
  private listeners: Set<BroadcastListener> = new Set();
  private currentSong: RadioSong | null = null;
  private isActive = false;
  private volume = 0.8;

  subscribe(listener: BroadcastListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: BroadcastEvent) {
    this.listeners.forEach((l) => l(event));
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audio) this.audio.volume = this.volume;
    // Also apply to DJ voice audio if currently speaking
    if (this.djAudio) this.djAudio.volume = this.volume;
  }

  getVolume() {
    return this.volume;
  }

  pause() {
    this.audio?.pause();
    this.djAudio?.pause();
  }

  resume() {
    this.audio?.play().catch(() => {});
  }

  stop() {
    this.isActive = false;
    this.stopCurrentAudio();
    this.currentSong = null;
  }

  getCurrentTime(): number {
    return this.audio?.currentTime ?? 0;
  }

  getDuration(): number {
    return this.audio?.duration ?? this.currentSong?.duration ?? 0;
  }

  getCurrentSong(): RadioSong | null {
    return this.currentSong;
  }

  /**
   * Plays a queue item. If it has a DJ intro audio URL, plays that first then the song.
   * onComplete is called when the track ends so the orchestrator can advance the queue.
   * Fully tears down any previously active audio before starting to prevent overlapping.
   */
  async playItem(
    item: RadioQueueItem,
    onComplete: () => void,
    onError: () => void
  ): Promise<void> {
    // ── Guarantee clean slate ──────────────────────────────────
    // Stop and detach all existing audio elements before beginning a new track.
    // This is the primary safeguard against overlapping voices on both stations.
    this.stopCurrentAudio();
    this.isActive = true;

    // 1. Play DJ intro if present
    if (item.hasIntro && item.djIntroAudioUrl) {
      await this.playDjIntro(item.djIntroAudioUrl, item.djIntroScript ?? '');
    }

    // Abort if stop() was called during the async DJ intro fetch / playback
    if (!this.isActive) return;

    // 2. Play the song
    await this.playSong(item.song, onComplete, onError);
  }

  private playSong(
    song: RadioSong,
    onComplete: () => void,
    onError: () => void
  ): Promise<void> {
    return new Promise((resolve) => {
      this.stopCurrentAudio();
      this.currentSong = song;

      const audio = new Audio(song.audioUrl);
      audio.volume = this.volume;
      audio.preload = 'auto';
      this.audio = audio;

      this.emit({ type: 'SONG_STARTED', song });

      const onTimeUpdate = () => {
        this.emit({
          type: 'TIME_UPDATE',
          currentTime: audio.currentTime,
          duration: audio.duration || song.duration,
        });
      };

      audio.addEventListener('timeupdate', onTimeUpdate);

      audio.onended = () => {
        audio.removeEventListener('timeupdate', onTimeUpdate);
        // Clear handlers immediately so they can't fire again after stop()
        audio.onended = null;
        audio.onerror = null;
        this.emit({ type: 'SONG_ENDED', song });
        onComplete();
        resolve();
      };

      audio.onerror = () => {
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.onended = null;
        audio.onerror = null;
        console.warn(`[BroadcastAgent] Playback error for "${song.title}" — requesting replacement.`);
        this.emit({ type: 'TRACK_ERROR', song });
        onError();
        resolve();
      };

      audio.play().catch(() => {
        audio.onended = null;
        audio.onerror = null;
        this.emit({ type: 'TRACK_ERROR', song });
        onError();
        resolve();
      });
    });
  }

  private playDjIntro(audioUrl: string, script: string): Promise<void> {
    return new Promise((resolve) => {
      if (!audioUrl) { resolve(); return; }

      // Tear down any existing DJ audio element first to prevent overlap
      if (this.djAudio) {
        this.djAudio.onended = null;
        this.djAudio.onerror = null;
        this.djAudio.pause();
        this.djAudio.src = '';
        this.djAudio = null;
      }

      this.emit({ type: 'DJ_INTRO_STARTED', script });
      const dj = new Audio(audioUrl);
      dj.volume = this.volume;
      this.djAudio = dj;

      const finish = () => {
        dj.onended = null;
        dj.onerror = null;
        this.emit({ type: 'DJ_INTRO_ENDED' });
        resolve();
      };

      dj.onended = finish;
      dj.onerror = finish;
      dj.play().catch(finish);
    });
  }

  private stopCurrentAudio() {
    if (this.audio) {
      // Detach handlers before pausing so onended cannot fire during teardown
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    if (this.djAudio) {
      this.djAudio.onended = null;
      this.djAudio.onerror = null;
      this.djAudio.pause();
      this.djAudio.src = '';
      this.djAudio = null;
    }
  }
}
