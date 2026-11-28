/**
 * DJChanceMix — Client & Cloud Persistence Service for Mix Configuration & Playlist Settings
 */

import {
  DEFAULT_MIX_CONFIGURATION,
  MixConfiguration,
  MixMode,
  PlaylistMixSettings,
} from '@/types/djchancemix';

const CONFIG_STORAGE_KEY = 'djchancemix_user_config_v1';
const PLAYLIST_SETTINGS_KEY = 'djchancemix_playlist_settings_v1';

export class DJChanceMixConfigService {
  public static loadLocalConfig(): MixConfiguration {
    if (typeof window === 'undefined') return { ...DEFAULT_MIX_CONFIGURATION };
    try {
      const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_MIX_CONFIGURATION };
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_MIX_CONFIGURATION,
        ...parsed,
      };
    } catch {
      return { ...DEFAULT_MIX_CONFIGURATION };
    }
  }

  public static saveLocalConfig(config: MixConfiguration): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch {}
  }

  public static async syncConfigFromServer(userId?: string): Promise<MixConfiguration> {
    const local = this.loadLocalConfig();
    if (typeof window === 'undefined' || !userId) return local;
    try {
      const res = await fetch(
        `/api/djchancemix/config?userId=${encodeURIComponent(userId)}`,
        { cache: 'no-store' }
      );
      if (!res.ok) return local;
      const json = await res.json();
      if (json?.config) {
        const merged = { ...DEFAULT_MIX_CONFIGURATION, ...json.config };
        this.saveLocalConfig(merged);
        return merged;
      }
      return local;
    } catch {
      return local;
    }
  }

  public static async saveConfig(config: MixConfiguration, userId?: string): Promise<MixConfiguration> {
    const merged: MixConfiguration = {
      ...DEFAULT_MIX_CONFIGURATION,
      ...config,
      userId: userId || config.userId,
      updatedAt: new Date().toISOString(),
    };
    this.saveLocalConfig(merged);

    if (typeof window !== 'undefined' && userId) {
      void fetch('/api/djchancemix/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, config: merged }),
      }).catch(() => {});
    }

    return merged;
  }

  public static loadAllPlaylistSettings(): Record<string, PlaylistMixSettings> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(PLAYLIST_SETTINGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  public static getPlaylistSettings(
    playlistId: string,
    defaultMode: MixMode = 'automix'
  ): PlaylistMixSettings {
    const all = this.loadAllPlaylistSettings();
    return (
      all[playlistId] || {
        playlistId,
        autoMixEnabled: true,
        mixingMode: defaultMode,
        shuffleAware: true,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  public static savePlaylistSettings(
    settings: PlaylistMixSettings,
    userId?: string
  ): PlaylistMixSettings {
    const updated: PlaylistMixSettings = {
      ...settings,
      userId: userId || settings.userId,
      updatedAt: new Date().toISOString(),
    };
    if (typeof window !== 'undefined') {
      try {
        const all = this.loadAllPlaylistSettings();
        all[settings.playlistId] = updated;
        localStorage.setItem(PLAYLIST_SETTINGS_KEY, JSON.stringify(all));
      } catch {}

      if (userId) {
        void fetch('/api/djchancemix/playlist-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, settings: updated }),
        }).catch(() => {});
      }
    }
    return updated;
  }
}

