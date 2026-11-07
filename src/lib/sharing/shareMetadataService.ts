import { Track, Video, Audiobook, PodcastEpisode, Producer, Artist, Album, Project } from '@/types/media';
import { Product } from '@/types/commerce';
import { Playlist } from '@/types/playlist';
import { MusicCatalogService, getDefaultCoverForTrack } from '@/lib/music/MusicCatalogService';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { MerchCatalogService } from '@/lib/commerce/MerchCatalogService';
import { ProducerCatalogService } from '@/lib/producers/ProducerCatalogService';
import { PlaylistService } from '@/lib/playlist/PlaylistService';
import { MOCK_ARTISTS, MOCK_ALBUMS, MOCK_TRACKS, MOCK_VIDEOS, MOCK_AUDIOBOOKS, MOCK_PRODUCTS, MOCK_PRODUCERS, MOCK_PROJECTS } from '@/lib/mockData';

export type ShareContentType =
  | 'song'
  | 'beat'
  | 'video'
  | 'podcast'
  | 'audiobook'
  | 'book'
  | 'merch'
  | 'producer'
  | 'artist'
  | 'album'
  | 'playlist'
  | 'project';

export interface ResolvedShareMetadata {
  id: string;
  type: ShareContentType;
  typeLabel: string;
  title: string;
  creator: string;
  description: string;
  coverUrl: string;
  canonicalUrl: string; // Always https://chancetekone.us/...
  directUrl: string;    // Current window origin if in browser, or canonical
  shareText: string;
  textMessageBody: string;
  smsUrl: string;
  facebookUrl: string;
  twitterUrl: string;
  linkedInUrl: string;
  whatsAppUrl: string;
  telegramUrl: string;
  emailSubject: string;
  emailBody: string;
  emailUrl: string;
  metadataBadges: string[];
}

export interface ShareableInput {
  type: ShareContentType;
  id?: string;
  item?: any;
  customTitle?: string;
  customCreator?: string;
  customDescription?: string;
  customCoverUrl?: string;
}

const PRODUCTION_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'https://chancetekone.us';

/**
 * Returns true if the cover image is missing or is the default master banner / generic platform logo
 */
export function isDefaultOrInvalidCover(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const lower = url.toLowerCase().trim();
  if (
    lower === '' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower.includes('chancetekone_banner.png') ||
    lower.includes('the_lounge_ambient.jpg') ||
    lower.includes('/images/logo') ||
    lower.endsWith('/logo.png') ||
    lower.includes('cover_1792') // dead upload hashes
  ) {
    return true;
  }
  return false;
}

/**
 * Sanitizes and extracts a clean, high-impact description
 */
export function cleanDescription(desc?: string, fallback: string = ''): string {
  if (!desc || typeof desc !== 'string') return fallback;
  const cleaned = desc
    .replace(/<[^>]*>?/gm, '') // strip HTML tags
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

/**
 * Resolves the authentic cover art for any platform entity, guaranteeing
 * it never falls back to the default ChanceTEK One banner.
 */
export function resolveAuthenticCover(type: ShareContentType, item: any): string {
  // If custom or item has a non-default cover, verify it:
  const directCover = item?.coverUrl || item?.imageUrl || item?.thumbnailUrl || item?.avatarUrl || item?.bannerUrl;
  if (directCover && !isDefaultOrInvalidCover(directCover)) {
    return directCover;
  }

  switch (type) {
    case 'song':
    case 'beat': {
      const track = item as Track;
      if (track) {
        try {
          return MusicCatalogService.resolveTrackCover(track);
        } catch {
          return track.coverUrl || '/images/genres/rnb-neo-soul.jpg';
        }
      }
      return '/images/genres/rnb-neo-soul.jpg';
    }

    case 'video': {
      const video = item as Video;
      if (video?.thumbnailUrl && !isDefaultOrInvalidCover(video.thumbnailUrl)) {
        return video.thumbnailUrl;
      }
      return '/images/genres/hip-hop.jpg';
    }

    case 'podcast': {
      const podcast = item as PodcastEpisode;
      if (podcast?.coverUrl && !isDefaultOrInvalidCover(podcast.coverUrl)) {
        return podcast.coverUrl;
      }
      const banner = (podcast as any)?.bannerUrl;
      if (banner && !isDefaultOrInvalidCover(banner)) {
        return banner;
      }
      return '/images/genres/hip-hop.jpg';
    }

    case 'audiobook':
    case 'book': {
      const ab = item as Audiobook;
      if (ab?.coverUrl && !isDefaultOrInvalidCover(ab.coverUrl)) {
        return ab.coverUrl;
      }
      return '/images/audiobooks/famio.jpg';
    }

    case 'merch': {
      const product = item as Product;
      if (product?.images && product.images.length > 0 && !isDefaultOrInvalidCover(product.images[0])) {
        return product.images[0];
      }
      return '/images/merch/signature_hoodie.jpg';
    }

    case 'producer': {
      const producer = item as Producer;
      if (producer?.avatarUrl && !isDefaultOrInvalidCover(producer.avatarUrl)) {
        return producer.avatarUrl;
      }
      if (producer?.bannerUrl && !isDefaultOrInvalidCover(producer.bannerUrl)) {
        return producer.bannerUrl;
      }
      return '/images/genres/hip-hop.jpg';
    }

    case 'artist': {
      const artist = item as Artist;
      if (artist?.avatarUrl && !isDefaultOrInvalidCover(artist.avatarUrl)) {
        return artist.avatarUrl;
      }
      if (artist?.bannerUrl && !isDefaultOrInvalidCover(artist.bannerUrl)) {
        return artist.bannerUrl;
      }
      return '/images/genres/rnb-neo-soul.jpg';
    }

    case 'album': {
      const album = item as Album;
      if (album) {
        try {
          return MusicCatalogService.resolveAlbumCover(album);
        } catch {
          // ignore error in server environments
        }
      }
      return '/images/genres/rnb-neo-soul.jpg';
    }

    case 'playlist': {
      const playlist = item as Playlist;
      if (playlist?.coverUrl && !isDefaultOrInvalidCover(playlist.coverUrl)) {
        return playlist.coverUrl;
      }
      return '/images/genres/rnb-neo-soul.jpg';
    }

    case 'project': {
      const project = item as Project;
      if (project?.id === 'project-1' || project?.id === 'return-of-the-break-beats') {
        return '/images/return_of_the_break_beats_master.png';
      }
      if (project?.coverUrl && !isDefaultOrInvalidCover(project.coverUrl)) {
        return project.coverUrl;
      }
      return '/images/return_of_the_break_beats_master.png';
    }

    default:
      return '/images/genres/rnb-neo-soul.jpg';
  }
}

/**
 * Returns human-readable label for content type badge
 */
function getTypeLabel(type: ShareContentType, item?: any): string {
  switch (type) {
    case 'song':
      return item?.genre?.toLowerCase().includes('beat') ? 'Breakbeat Track' : 'Master Song';
    case 'beat':
      return 'Breakbeat Instrumental';
    case 'video':
      return '4K Cinema Video';
    case 'podcast':
      return 'Podcast Episode';
    case 'audiobook':
      return 'Audiobook Literature';
    case 'book':
      return 'Author Book & Literature';
    case 'merch':
      return 'Official Merchandise';
    case 'producer':
      return 'Master Producer';
    case 'artist':
      return 'Official Recording Artist';
    case 'album':
      return 'Studio Album';
    case 'playlist':
      return 'Curated Crate & Playlist';
    case 'project':
      return 'Featured Upcoming Work';
    default:
      return 'Featured Media';
  }
}

/**
 * Resolves complete metadata for sharing any platform entity
 */
export function resolveShareMetadata(input: ShareableInput): ResolvedShareMetadata {
  let { type, id = '', item } = input;

  // Retrieve item if missing but id is provided:
  if (!item && id) {
    switch (type) {
      case 'song':
      case 'beat':
        try {
          item = MusicCatalogService.getTrackById(id) || MOCK_TRACKS.find((t) => t.id === id);
        } catch {
          item = MOCK_TRACKS.find((t) => t.id === id);
        }
        break;
      case 'video':
        try {
          item = MediaCatalogService.getVideoById(id) || MOCK_VIDEOS.find((v) => v.id === id);
        } catch {
          item = MOCK_VIDEOS.find((v) => v.id === id);
        }
        break;
      case 'podcast':
        try {
          item = MediaCatalogService.getPodcastById(id);
        } catch {
          item = undefined;
        }
        break;
      case 'audiobook':
      case 'book':
        try {
          item = MediaCatalogService.getAudiobookById(id) || MOCK_AUDIOBOOKS.find((a) => a.id === id);
        } catch {
          item = MOCK_AUDIOBOOKS.find((a) => a.id === id);
        }
        break;
      case 'merch':
        try {
          item = MerchCatalogService.getProductById(id) || MOCK_PRODUCTS.find((p) => p.id === id);
        } catch {
          item = MOCK_PRODUCTS.find((p) => p.id === id);
        }
        break;
      case 'producer':
        try {
          item = ProducerCatalogService.getProducerById(id) || MOCK_PRODUCERS.find((p) => p.id === id);
        } catch {
          item = MOCK_PRODUCERS.find((p) => p.id === id);
        }
        break;
      case 'artist':
        item = MOCK_ARTISTS.find((a) => a.id === id);
        break;
      case 'album':
        try {
          item = MusicCatalogService.getAlbumById(id) || MOCK_ALBUMS.find((a) => a.id === id);
        } catch {
          item = MOCK_ALBUMS.find((a) => a.id === id);
        }
        break;
      case 'playlist':
        try {
          item = PlaylistService.getPlaylistById(id);
        } catch {
          item = undefined;
        }
        break;
      case 'project':
        item = MOCK_PROJECTS.find((p) => p.id === id || p.id === `project-${id}` || (id === 'return-of-the-break-beats' && p.id === 'project-1'));
        break;
    }
  }

  const effectiveId = item?.id || id || 'item';

  // Extract authentic title:
  let title =
    input.customTitle ||
    item?.title ||
    item?.name ||
    (type === 'merch' ? item?.name || item?.title : '') ||
    'Featured Media';

  // Extract authentic creator (Artist, Author, Host, Producer, etc.):
  let creator = input.customCreator || '';
  if (!creator) {
    switch (type) {
      case 'song':
      case 'beat':
        creator = item?.artistName || 'ChanceTEK One';
        break;
      case 'video':
        creator = item?.artist || item?.creator || 'Visual Cinema';
        break;
      case 'podcast':
        creator = item?.host || item?.showTitle || 'ChanceTEK One';
        break;
      case 'audiobook':
      case 'book':
        creator = item?.author ? `Author ${item.author}` : (item?.narrator ? `Narrated by ${item.narrator}` : 'Master Author');
        break;
      case 'merch':
        creator = item?.artistName || 'ChanceTEK One Official Merch';
        break;
      case 'producer':
        creator = item?.role || 'Master Producer & Beatmaker';
        break;
      case 'artist':
        creator = item?.role || 'Featured Recording Act';
        break;
      case 'album':
        creator = item?.artistName || (item as any)?.artist || 'Master Recording Artist';
        break;
      case 'playlist':
        creator = item?.ownerName ? `Curated by ${item.ownerName}` : 'ChanceTEK One Crate';
        break;
      case 'project':
        creator = item?.producerName || item?.presenter || item?.label || 'ChanceTEK One';
        break;
      default:
        creator = 'ChanceTEK One';
    }
  }

  // Extract authentic description:
  let description = input.customDescription || '';
  if (!description) {
    switch (type) {
      case 'song':
      case 'beat':
        description =
          cleanDescription(item?.lyrics) ||
          cleanDescription(item?.description) ||
          `"${title}" by ${creator}. Authentic ${item?.genre || 'Soul & Breakbeat'} stream engineered at ${item?.bpm ? `${item.bpm} BPM` : 'authentic tempo'} on ChanceTEK One.`;
        break;
      case 'video':
        description =
          cleanDescription(item?.description) ||
          `Watch "${title}" (${creator}) in pristine high-definition 4K visual cinema on ChanceTEK One.`;
        break;
      case 'podcast':
        description =
          cleanDescription(item?.description) ||
          `Listen to "${title}" hosted by ${creator}. Master podcast broadcast exploring sonic culture on ChanceTEK One.`;
        break;
      case 'audiobook':
      case 'book':
        description =
          cleanDescription(item?.description) ||
          cleanDescription(item?.synopsis) ||
          `Explore "${title}" by ${creator}. Master spoken audiobook narrative and literature streaming on ChanceTEK One.`;
        break;
      case 'merch':
        description =
          cleanDescription(item?.description) ||
          `Official ${title}. Exclusive limited-edition street apparel and vinyl collector merchandise by ChanceTEK One.`;
        break;
      case 'producer':
        description =
          cleanDescription(item?.bio) ||
          `${title} — ${creator}. Legendary beatmaker crates, breakbeat instrumentals, and production credits on ChanceTEK One.`;
        break;
      case 'artist':
        description =
          cleanDescription(item?.bio) ||
          `${title} — ${creator}. Complete discography, stream singles, albums, and master vinyl collections on ChanceTEK One.`;
        break;
      case 'album':
        description =
          cleanDescription(item?.description) ||
          `Experience "${title}" by ${creator}. Full studio album collection with master breakbeats on ChanceTEK One.`;
        break;
      case 'playlist':
        description =
          cleanDescription(item?.description) ||
          `"${title}" — ${creator}. Curated playlist featuring ${item?.itemCount || 0} tracks on ChanceTEK One.`;
        break;
      case 'project':
        description =
          cleanDescription(item?.description) ||
          cleanDescription(item?.narrativeOverview) ||
          `The Forthcoming Project is based on The Classic Break Beats of Hip Hop Music and Culture Featuring Various Artists and A Documentary Film.`;
        break;
      default:
        description = `Stream and explore "${title}" on ChanceTEK One.`;
    }
  }

  // Resolve authentic cover art:
  const coverUrl = input.customCoverUrl && !isDefaultOrInvalidCover(input.customCoverUrl)
    ? input.customCoverUrl
    : resolveAuthenticCover(type, item);

  // Canonical public share URL (Required by social crawlers & text message link previews):
  let relativePath = `/music/${effectiveId}`;
  switch (type) {
    case 'song':
    case 'beat':
      relativePath = `/music/${effectiveId}`;
      break;
    case 'video':
      relativePath = `/videos/${effectiveId}`;
      break;
    case 'podcast':
      relativePath = `/podcasts/${effectiveId}`;
      break;
    case 'audiobook':
    case 'book':
      relativePath = `/audiobooks/${effectiveId}`;
      break;
    case 'merch':
      relativePath = `/merch/${effectiveId}`;
      break;
    case 'producer':
      relativePath = `/producers?producer=${encodeURIComponent(item?.name || effectiveId)}`;
      break;
    case 'artist':
      relativePath = `/artists/${effectiveId}`;
      break;
    case 'album':
      relativePath = `/albums/${effectiveId}`;
      break;
    case 'playlist':
      relativePath = `/playlists/${effectiveId}`;
      break;
    case 'project': {
      const projHash = effectiveId === 'return-of-the-break-beats' ? 'project-1' : effectiveId.startsWith('project-') ? effectiveId : `project-${effectiveId}`;
      relativePath = `/projects#${projHash}`;
      break;
    }
  }

  const canonicalUrl = `${PRODUCTION_ORIGIN}${relativePath}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : PRODUCTION_ORIGIN;
  const directUrl = `${origin}${relativePath}`;

  // Badges:
  const metadataBadges: string[] = [];
  if (item?.genre) metadataBadges.push(item.genre);
  if (item?.bpm) metadataBadges.push(`${item.bpm} BPM`);
  if (item?.duration) {
    const mins = Math.floor(item.duration / 60);
    const secs = String(item.duration % 60).padStart(2, '0');
    metadataBadges.push(`${mins}:${secs}`);
  }
  if (item?.price) metadataBadges.push(`$${item.price}`);
  if (item?.releaseYear) metadataBadges.push(String(item.releaseYear));

  // Text message body specifically tailored for SMS / iMessage:
  const textMessageBody = `Listen to "${title}" by ${creator} on ChanceTEK One!

${description}

Stream now:
${canonicalUrl}`;

  // General share text:
  const shareText = `Check out "${title}" by ${creator} on ChanceTEK One: ${description}`;

  // Social share URLs:
  const encodedUrl = encodeURIComponent(canonicalUrl);
  const encodedText = encodeURIComponent(shareText);
  const encodedTitle = encodeURIComponent(title);
  const encodedSms = encodeURIComponent(textMessageBody);

  const smsUrl = `sms:?&body=${encodedSms}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out "${title}" by ${creator} on @chancetekone\n\n${description.slice(0, 130)}`)}&url=${encodedUrl}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  const whatsAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`*${title}* by _${creator}_\n\n${description}\n\n${canonicalUrl}`)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(`*${title}* by ${creator}\n${description}`)}`;

  const emailSubject = `${title} by ${creator} — ChanceTEK One`;
  const emailBody = `Hey,\n\nI wanted to share this with you on ChanceTEK One:\n\n"${title}" by ${creator}\n\n${description}\n\nStream now: ${canonicalUrl}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  return {
    id: effectiveId,
    type,
    typeLabel: getTypeLabel(type, item),
    title,
    creator,
    description,
    coverUrl,
    canonicalUrl,
    directUrl,
    shareText,
    textMessageBody,
    smsUrl,
    facebookUrl,
    twitterUrl,
    linkedInUrl,
    whatsAppUrl,
    telegramUrl,
    emailSubject,
    emailBody,
    emailUrl,
    metadataBadges,
  };
}

/**
 * Resolves metadata by entity type and ID alone (useful in Server Components / generateMetadata)
 */
export function resolveShareMetadataById(type: ShareContentType, id: string): ResolvedShareMetadata {
  try {
    return resolveShareMetadata({ type, id });
  } catch (err) {
    const relPath =
      type === 'song' || type === 'beat'
        ? `/music/${id}`
        : type === 'project'
        ? `/projects#${id}`
        : type === 'merch'
        ? `/merch/${id}`
        : `/${type}s/${id}`;
    const canonicalUrl = `https://chancetekone.us${relPath}`;
    return {
      id: id || 'item',
      type,
      typeLabel: 'Featured Media',
      title: 'ChanceTEK One',
      creator: 'ChanceTEK One',
      description: 'Stream master breakbeat music, 4K videos, audiobooks, and culture on ChanceTEK One.',
      coverUrl: '/images/genres/rnb-neo-soul.jpg',
      canonicalUrl,
      directUrl: canonicalUrl,
      shareText: 'Check out ChanceTEK One',
      textMessageBody: 'Check out ChanceTEK One',
      smsUrl: '',
      facebookUrl: '',
      twitterUrl: '',
      linkedInUrl: '',
      whatsAppUrl: '',
      telegramUrl: '',
      emailSubject: 'ChanceTEK One',
      emailBody: '',
      emailUrl: '',
      metadataBadges: [],
    };
  }
}
