'use client';

import {
  AnalyticsEvent,
  AnalyticsEventType,
  GeoLocationInfo,
  DeviceInfo,
} from '@/types/analytics';

const STORAGE_KEY = 'spades_admin_events_v2';

class AnalyticsEngineClass {
  private events: AnalyticsEvent[] = [];
  private listeners: Set<(event: AnalyticsEvent) => void> = new Set();
  private batchListeners: Set<(events: AnalyticsEvent[]) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadInitialEvents();
    }
  }

  private loadInitialEvents() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Only keep real user events (discard legacy simulated/seed events)
          this.events = parsed.filter((e) => !e.id?.startsWith('seed-') && !e.id?.startsWith('evt-sim-'));
          return;
        }
      }
    } catch (e) {
      console.warn('Error loading analytics events from storage:', e);
    }
    this.events = [];
    this.persistEvents();
  }

  private persistEvents() {
    if (typeof window === 'undefined') return;
    try {
      // Keep most recent 5000 real events in localStorage
      const trimmed = this.events.slice(-5000);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Failed to persist analytics events:', e);
    }
  }

  public getEvents(): AnalyticsEvent[] {
    return this.events;
  }

  public subscribe(callback: (event: AnalyticsEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public subscribeAll(callback: (events: AnalyticsEvent[]) => void): () => void {
    this.batchListeners.add(callback);
    return () => this.batchListeners.delete(callback);
  }

  private notify(event: AnalyticsEvent) {
    this.listeners.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error('Analytics listener error:', err);
      }
    });
    this.batchListeners.forEach((cb) => {
      try {
        cb(this.events);
      } catch (err) {
        console.error('Analytics batch listener error:', err);
      }
    });
  }

  public triggerManualEvent(): void {
    // No-op to prevent synthetic data generation
  }

  public trackEvent(
    eventOrType:
      | string
      | (Partial<AnalyticsEvent> & { eventType?: AnalyticsEventType; action?: string; resource?: string }),
    payload?: Record<string, any>
  ): AnalyticsEvent {
    let eventData: Partial<AnalyticsEvent> & { eventType: AnalyticsEventType; action: string; resource: string };

    if (typeof eventOrType === 'string') {
      const p = payload || {};
      eventData = {
        eventType: eventOrType as AnalyticsEventType,
        action: p.action || p.name || p.title || eventOrType,
        resource: p.resource || p.name || p.title || 'Platform Asset',
        resourceId: p.resourceId || p.contentId || p.playlistId || p.trackId || p.videoId,
        userId: p.userId,
        userName: p.userName,
        userEmail: p.userEmail,
        platformArea: p.platformArea || (eventOrType.toLowerCase().includes('video') ? 'Videos' : eventOrType.toLowerCase().includes('playlist') ? 'Playlists' : 'Music'),
        metadata: p,
      };
    } else {
      eventData = {
        ...eventOrType,
        eventType: (eventOrType.eventType || 'FEATURE_ACCESSED') as AnalyticsEventType,
        action: eventOrType.action || 'Platform Interaction',
        resource: eventOrType.resource || 'Platform',
      };
    }

    // Detect authentic client device info
    let device: DeviceInfo = eventData.device as DeviceInfo;
    if (!device && typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/i.test(ua);
      
      device = {
        type: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
        browser: ua.includes('Edg')
          ? 'Edge'
          : ua.includes('Chrome')
          ? 'Chrome'
          : ua.includes('Safari') && !ua.includes('Chrome')
          ? 'Safari'
          : ua.includes('Firefox')
          ? 'Firefox'
          : 'Web Browser',
        os: ua.includes('Win')
          ? 'Windows'
          : ua.includes('Mac')
          ? 'macOS'
          : ua.includes('Android')
          ? 'Android'
          : ua.includes('iPhone') || ua.includes('iPad')
          ? 'iOS'
          : ua.includes('Linux')
          ? 'Linux'
          : 'Unknown OS',
      };
    }

    const loc: GeoLocationInfo = eventData.geo || {
      country: 'United States',
      countryCode: 'US',
      region: 'Local Network',
      city: 'Live Session',
      ip: '127.0.0.1',
    };

    const newEvent: AnalyticsEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: eventData.timestamp || new Date().toISOString(),
      eventType: eventData.eventType,
      userId: eventData.userId,
      userName: eventData.userName,
      userEmail: eventData.userEmail,
      isAuthenticated: Boolean(eventData.userId),
      platformArea: eventData.platformArea || 'Music',
      action: eventData.action,
      resource: eventData.resource,
      resourceId: eventData.resourceId,
      metadata: eventData.metadata || {},
      geo: loc,
      device: device || { type: 'desktop', browser: 'Browser', os: 'Desktop' },
      sessionId: eventData.sessionId || (typeof window !== 'undefined' ? (sessionStorage.getItem('spades_session_id') || (() => {
        const id = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        sessionStorage.setItem('spades_session_id', id);
        return id;
      })()) : `sess-${Date.now()}`),
    };

    this.events.push(newEvent);
    this.persistEvents();
    this.notify(newEvent);
    return newEvent;
  }

  // Simulation is completely disabled - only real events are recorded
  public getIsSimulating(): boolean {
    return false;
  }

  public clearEvents() {
    this.events = [];
    this.persistEvents();
    this.trackEvent({
      eventType: 'SYSTEM_EVENT',
      action: 'Analytics log reset to zero real events',
      resource: 'Platform Telemetry',
      platformArea: 'Admin',
      isAuthenticated: true,
    });
  }
}

export const AnalyticsEngine = new AnalyticsEngineClass();
