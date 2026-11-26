/**
 * ChanceTEK One — Authentic Extracted Video Frame Thumbnail Registry
 *
 * Maps every platform video (by ID or videoUrl filename) to its real, extracted
 * full-resolution JPEG frame stored in `/public/images/video-thumbs/`.
 * Used by OpenGraph / Twitter / SMS / Messenger / Famio.us share resolvers AND
 * UI cards so videos ALWAYS share and display their own authentic video frame
 * (just like YouTube) — never generic studio_cover.jpg or genre art.
 */

export const VIDEO_THUMBNAIL_BY_ID: Record<string, string> = {
  'video-1': '/images/video-thumbs/video-1.jpg',
  'video-2': '/images/video-thumbs/video-2.jpg',
  'video-3': '/images/video-thumbs/video-3.jpg',
  'video-4': '/images/video-thumbs/video-4.jpg',
  'video-5': '/images/video-thumbs/video-5.jpg',
  'video-6': '/images/video-thumbs/video-6.jpg',
  'video-7': '/images/video-thumbs/video-7.jpg',
  'video-8': '/images/video-thumbs/video-8.jpg',
  'video-9': '/images/video-thumbs/video-9.jpg',
  'video-10': '/images/video-thumbs/video-10.jpg',
  'video-11': '/images/video-thumbs/video-11.jpg',
  'video-12': '/images/video-thumbs/video-12.jpg',
  'video-13': '/images/video-thumbs/video-13.jpg',
  'video-14': '/images/video-thumbs/video-14.jpg',
  'video-15': '/images/video-thumbs/video-15.jpg',
  'video-16': '/images/video-thumbs/video-16.jpg',
};

const VIDEO_THUMBNAIL_BY_FILENAME: Record<string, string> = {
  'chancetek hq.mp4': '/images/video-thumbs/video-1.jpg',
  'chancetek hq2.mp4': '/images/video-thumbs/video-2.jpg',
  'cynemora.mp4': '/images/video-thumbs/video-3.jpg',
  'cynemora2.mp4': '/images/video-thumbs/video-4.jpg',
  'cynemora3 - copy.mp4': '/images/video-thumbs/video-5.jpg',
  'cynemora6.mp4': '/images/video-thumbs/video-6.jpg',
  'cynemora221.mp4': '/images/video-thumbs/video-7.jpg',
  'iskylar.mp4': '/images/video-thumbs/video-8.jpg',
  'stridetiq.mp4': '/images/video-thumbs/video-9.jpg',
  'the fam... famio.mp4': '/images/video-thumbs/video-10.jpg',
  'the fam... logo.mp4': '/images/video-thumbs/video-11.jpg',
  'chancetek one remix.mp4': '/images/video-thumbs/video-12.jpg',
  'chancetek one remix 1.mp4': '/images/video-thumbs/video-13.jpg',
  'chancetek once remix 2.mp4': '/images/video-thumbs/video-14.jpg',
  'chancetek one remix 3.mp4': '/images/video-thumbs/video-15.jpg',
  'chancetek one remix 4.mp4': '/images/video-thumbs/video-16.jpg',
  'orlandofigueroa.mp4': '/images/video-thumbs/OrlandoFigueroa.jpg',
  '1793148168438_orlandofigueroa.mov': '/images/video-thumbs/OrlandoFigueroa.jpg',
  'kwame book promo 1.mp4': '/images/video-thumbs/Kwame_Book_Promo_1.jpg',
  'fathertime4k.mp4': '/images/video-thumbs/FatherTime4K.jpg',
  'chancetekone1.mp4': '/images/video-thumbs/chancetekone1.jpg',
  'timeless_music_algorithm.mp4': '/images/video-thumbs/timeless_music_algorithm.jpg',
};

const GENERIC_OR_NON_VIDEO_COVERS = [
  '/images/studio_cover.jpg',
  '/images/logo.png',
  '/images/chancetekone_banner.png',
  '/images/chancetek_banner.png',
  '/images/the_lounge_ambient.jpg',
  '/images/chancetekone_logo',
  '/images/chancetekone_icon',
  '/images/genres/',
  '/images/default-cover.jpg',
];

export function isGenericVideoThumbnailUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const lower = url.trim().toLowerCase();
  if (!lower || lower === 'null' || lower === 'undefined' || lower.startsWith('blob:') || lower.startsWith('indexeddb:')) {
    return true;
  }
  return GENERIC_OR_NON_VIDEO_COVERS.some((pattern) => lower.includes(pattern));
}

/**
 * Resolves the authentic extracted thumbnail image for a video.
 * 1. Exact extracted frame in `/images/video-thumbs/` matched by video ID or videoUrl filename.
 * 2. Real custom/uploaded non-generic thumbnailUrl (e.g. Firebase Storage URL or canvas-captured poster).
 * Returns empty string if no static image exists yet (so UI components can fall back to live frame extraction).
 */
export function resolveAuthenticVideoThumbnail(
  videoId?: string | null,
  videoUrl?: string | null,
  thumbnailUrl?: string | null
): string {
  // 1. Check extracted frame by exact video ID
  if (videoId && VIDEO_THUMBNAIL_BY_ID[videoId]) {
    return VIDEO_THUMBNAIL_BY_ID[videoId];
  }

  // 2. Check extracted frame by video filename
  if (videoUrl) {
    try {
      const cleaned = decodeURIComponent(videoUrl.split('?')[0].split('#')[0]);
      const baseName = cleaned.split('/').pop()?.toLowerCase().trim() || '';
      if (baseName && VIDEO_THUMBNAIL_BY_FILENAME[baseName]) {
        return VIDEO_THUMBNAIL_BY_FILENAME[baseName];
      }
    } catch {
      const baseName = videoUrl.split('?')[0].split('#')[0].split('/').pop()?.toLowerCase().trim() || '';
      if (baseName && VIDEO_THUMBNAIL_BY_FILENAME[baseName]) {
        return VIDEO_THUMBNAIL_BY_FILENAME[baseName];
      }
    }
  }

  // 3. Use custom/uploaded authentic thumbnail if it's NOT generic cover art
  if (thumbnailUrl && !isGenericVideoThumbnailUrl(thumbnailUrl)) {
    return thumbnailUrl.trim();
  }

  return '';
}

