/**
 * Types for the YouTube Co-Listening Room App
 */

export interface Track {
  id: string; // Unique queue item ID
  title: string;
  artist: string;
  youtubeId: string;
  duration: number; // in seconds
  thumbnail: string;
  addedBy: string; // userId
  addedByName: string; // userName
  upvotes: string[]; // array of userIds
  downvotes: string[]; // array of userIds
  score: number; // upvotes - downvotes
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
  type: 'chat' | 'system';
}

export interface Participant {
  userId: string;
  userName: string;
  joinedAt: number;
  isHost: boolean;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number; // seconds
  lastUpdated: number; // timestamp
}

export interface Room {
  code: string; // 5-digit code
  hostId: string;
  queue: Track[];
  history: Track[];
  participants: Participant[];
  chat: ChatMessage[];
  currentTrack: Track | null;
  playback: PlaybackState;
  skipVotes: string[]; // userIds who voted to skip current track
}

export interface TrackReaction {
  id: string;
  emoji: string;
  userName: string;
  timestamp: number;
}
