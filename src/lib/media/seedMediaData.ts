import type { PodcastEpisode } from '@/types/media';

export const SEED_PODCASTS: PodcastEpisode[] = [
  {
    id: 'podcast-ep-1',
    title: 'Episode 1: The Architecture of Agentic AI & Sonic Systems',
    showTitle: 'ChanceTEK Masterminds Podcast',
    host: 'Chancellor @ ChanceTEK LLC',
    description:
      'Deep dive into autonomous agentic pipelines, MCP protocol integration, 12-bit hardware samplers, and the future of cultural media sovereignty.',
    mediaUrl: '/audio/Agentic AI.mp3',
    mediaType: 'audio',
    coverUrl: '/images/audiobooks/agentic_ai.jpg',
    duration: 1840,
    releaseDate: '2026-03-01',
    category: 'Technology & AI',
    playCount: 0,
    likeCount: 0,
  },
  {
    id: 'podcast-ep-2',
    title: 'Episode 2: The SP-1200 Concrete Era & Turntable Science',
    showTitle: 'ChanceTEK One Crate Talk',
    host: 'The Crate Diggers & Chancellor',
    description:
      'Exploring the genesis of 12-bit sampling, chop techniques, classic funk drum breaks, and the culture of unreleased acetate test pressings.',
    mediaUrl: '/audio/Fort Apache.mp3',
    mediaType: 'audio',
    coverUrl: '/images/genres/hip-hop.jpg',
    duration: 2150,
    releaseDate: '2026-03-08',
    category: 'Music Culture',
    playCount: 0,
    likeCount: 0,
  },
  {
    id: 'podcast-ep-3',
    title: 'Episode 3: Visual Cinema, CyneMora & Cultural Storytelling',
    showTitle: 'ChanceTEK Visual Cinema Hour',
    host: 'Chancellor @ ChanceTEK LLC',
    description:
      'An episodic exploration of high-definition cinema, architectural spatial rendering, and the creative vision behind CyneMora and The Famio.',
    mediaUrl: '/videos/CyneMora221.mp4',
    mediaType: 'video',
    coverUrl: '/images/chancetek_banner.png',
    duration: 980,
    releaseDate: '2026-03-15',
    category: 'Film & Visual Arts',
    playCount: 0,
    likeCount: 0,
  },
];

