// ============================================================
// Agent 3: Programming Agent
// Autonomously creates and maintains station playlists.
// Respects admin approval, rotation settings, and musical intelligence.
// ============================================================

import { RadioSong, RadioStationId, RadioQueueItem } from '@/types/radio';

const MIN_QUEUE_LENGTH = 6;
const ARTIST_COOLDOWN = 2;   // songs before same artist can repeat
const SONG_COOLDOWN   = 8;   // songs before same track can repeat

interface ProgrammingContext {
  stationId: RadioStationId;
  catalog: RadioSong[];
  recentlyPlayed: RadioSong[];
  currentQueue: RadioQueueItem[];
}

export class ProgrammingAgent {
  /**
   * Returns the full station queue extended to at least MIN_QUEUE_LENGTH items.
   * Call this whenever the queue needs topping up.
   */
  static buildQueue(ctx: ProgrammingContext): RadioQueueItem[] {
    const available = this.getEligibleSongs(ctx);
    if (available.length === 0) return ctx.currentQueue;

    const queue = [...ctx.currentQueue];
    const playedIds = new Set(ctx.recentlyPlayed.slice(-SONG_COOLDOWN).map((s) => s.id));
    const recentArtists = ctx.recentlyPlayed.slice(-ARTIST_COOLDOWN).map((s) => s.artist);

    while (queue.length < MIN_QUEUE_LENGTH) {
      const nextSong = this.selectNext(available, playedIds, recentArtists, queue);
      if (!nextSong) break;
      queue.push({ song: nextSong, hasIntro: false });
      playedIds.add(nextSong.id);
      recentArtists.push(nextSong.artist);
    }

    return queue;
  }

  /**
   * Filters the catalog to songs approved & in-rotation for the given station.
   */
  static getEligibleSongs(ctx: ProgrammingContext): RadioSong[] {
    return ctx.catalog.filter(
      (s) =>
        s.isApproved &&
        s.inRotation &&
        s.stations.includes(ctx.stationId)
    );
  }

  private static selectNext(
    eligible: RadioSong[],
    recentIds: Set<string>,
    recentArtists: string[],
    currentQueue: RadioQueueItem[]
  ): RadioSong | null {
    const queueIds = new Set(currentQueue.map((q) => q.song.id));

    // Prefer songs not played recently and not already queued
    const preferred = eligible.filter(
      (s) => !recentIds.has(s.id) && !queueIds.has(s.id)
    );

    // Further prefer different artist from recent artists
    const diverseArtist = preferred.filter(
      (s) => !recentArtists.includes(s.artist)
    );

    const pool = diverseArtist.length > 0 ? diverseArtist : preferred.length > 0 ? preferred : eligible;
    if (pool.length === 0) return null;

    // Weighted random: prefer lower totalPlays for balanced rotation
    const sorted = [...pool].sort((a, b) => a.totalPlays - b.totalPlays);
    const topTier = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.4)));
    return topTier[Math.floor(Math.random() * topTier.length)];
  }

  /**
   * Inserts a newly approved song into the next suitable position in the queue.
   */
  static insertNewSong(
    queue: RadioQueueItem[],
    song: RadioSong,
    position: number = 3
  ): RadioQueueItem[] {
    const updated = [...queue];
    const insertAt = Math.min(position, updated.length);
    updated.splice(insertAt, 0, { song, hasIntro: true });
    return updated;
  }
}
