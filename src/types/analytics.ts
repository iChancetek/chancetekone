export type AnalyticsEventType =
  | 'USER_CREATED'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'SONG_PLAY_STARTED'
  | 'SONG_PLAY_COMPLETED'
  | 'SONG_SKIPPED'
  | 'SONG_REPLAYED'
  | 'ALBUM_PLAYED'
  | 'VIDEO_STARTED'
  | 'VIDEO_COMPLETED'
  | 'VIDEO_LIKED'
  | 'AUDIOBOOK_STARTED'
  | 'AUDIOBOOK_COMPLETED'
  | 'AUDIOBOOK_CHAPTER_PLAYED'
  | 'PLAYLIST_CREATED'
  | 'PLAYLIST_PLAYED'
  | 'PLAYLIST_SHARED'
  | 'PLAYLIST_LIKED'
  | 'MERCH_VIEWED'
  | 'MERCH_CLICKED'
  | 'MERCH_ADDED_TO_CART'
  | 'MERCH_CHECKOUT_STARTED'
  | 'MERCH_PURCHASED'
  | 'RATING_CREATED'
  | 'SEARCH_PERFORMED'
  | 'FEATURE_ACCESSED'
  | 'ADMIN_ACTION'
  // Radio module events (additive — do not remove existing types above)
  | 'RADIO_STATION_STARTED'
  | 'RADIO_SONG_PLAYED'
  | 'RADIO_DJ_INTRO'
  | 'RADIO_TRACK_SKIPPED'
  | 'RADIO_ORCHESTRATOR_ROTATION'
  | 'RADIO_UPLOAD'
  | 'MEDIA_LIKED'
  | 'SYSTEM_EVENT'
  | 'media_like'
  | 'like'
  | 'playlist_create'
  | 'playlist_share'
  | string;

export type TimeRangeKey =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'this_year'
  | 'previous_year'
  | 'custom';

export interface GeoLocationInfo {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  ip: string;
}

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
}

export interface AnalyticsEvent {
  id: string;
  timestamp: string; // ISO UTC format
  eventType: AnalyticsEventType;
  userId?: string;
  userName?: string;
  userEmail?: string;
  isAuthenticated: boolean;
  platformArea: string; // e.g., 'Music', 'Albums', 'Videos', 'Audiobooks', 'Playlists', 'Merch', 'Search', 'Profile', 'Admin'
  action: string; // human readable action e.g. "Started playing Fort Apache"
  resource: string; // e.g. "Fort Apache", "ChanceTEK One Hoodie"
  resourceId?: string;
  metadata?: Record<string, any>;
  geo: GeoLocationInfo;
  device: DeviceInfo;
  sessionId: string;
}

export interface KPICardData {
  id: string;
  title: string;
  value: string | number;
  rawNumber: number;
  changePercent: number; // e.g. +18.4 or -3.2
  trend: 'up' | 'down' | 'neutral';
  comparisonPeriod: string; // e.g. "vs previous 30 days"
  category: 'users' | 'media' | 'merch' | 'leaders';
  sparkline: number[];
  unit?: string;
}

export interface ChartDataPoint {
  label: string;
  timestamp?: string;
  value: number;
  secondaryValue?: number;
  [key: string]: any;
}

export interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
  dropoffPercentage: number;
  color: string;
}

export interface SongAnalyticsRecord {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  plays: number;
  uniqueListeners: number;
  completionRate: number; // 0-100%
  replays: number;
  skips: number;
  rating: number; // e.g. 4.9
  purchases: number;
  trendPercent: number;
  genre: string;
  bpm: number;
  likes: number;
}

export interface AlbumAnalyticsRecord {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  plays: number;
  uniqueListeners: number;
  completionRate: number;
  totalPurchases: number;
  rating: number;
  trackCount: number;
  trendPercent: number;
  likes: number;
}

export interface VideoAnalyticsRecord {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  views: number;
  uniqueViewers: number;
  completedViews: number;
  partialViews: number;
  replays: number;
  likes: number;
  rating: number;
  avgWatchDuration: string; // e.g. "4m 12s"
  completionRate: number;
  trendPercent: number;
  category: string;
}

export interface AudiobookAnalyticsRecord {
  id: string;
  title: string;
  author: string;
  narrator: string;
  coverUrl: string;
  starts: number;
  completions: number;
  listeningHours: number;
  uniqueListeners: number;
  completionRate: number;
  rating: number;
  trendPercent: number;
  topChapter: string;
}

export interface PlaylistAnalyticsRecord {
  id: string;
  title: string;
  creator: string;
  coverUrl: string;
  itemCount: number;
  plays: number;
  shares: number;
  likes: number;
  followers: number;
  trendPercent: number;
}

export interface MerchAnalyticsRecord {
  id: string;
  title: string;
  category: string;
  price: number;
  images: string[];
  views: number;
  clicks: number;
  ctr: number; // %
  cartAdditions: number;
  purchases: number;
  conversionRate: number; // %
  revenue: number;
  trendPercent: number;
  inStock: boolean;
  inventoryCount: number;
}

export interface GeoDistributionRecord {
  country: string;
  countryCode: string;
  region: string;
  users: number;
  visitors: number;
  plays: number;
  purchases: number;
  revenue: number;
  percentage: number;
}

export interface UserJourneyPath {
  id: string;
  path: string[];
  frequency: number;
  conversionRate: number;
  avgDuration: string;
}

export interface SessionAnalyticsSummary {
  activeSessions: number;
  avgSessionDuration: string;
  avgSessionMinutes: number;
  longestSession: string;
  sessionsPerUser: number;
  dau: number;
  wau: number;
  mau: number;
}
