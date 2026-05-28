import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipForward, Volume2, Maximize2, Minimize2, Radio } from "lucide-react";
import { Room, Track, PlaybackState } from "../types";
import { motion } from "motion/react";

interface MiniPlayerProps {
  room: Room;
  userId: string;
  isHost: boolean;
  onSendWS: (msg: any) => void;
}

export default function MiniPlayer({ room, userId, isHost, onSendWS }: MiniPlayerProps) {
  const { currentTrack, playback, skipVotes, participants } = room;

  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);
  const syncIntervalRef = useRef<any>(null);

  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [volume, setVolume] = useState(50);
  const [localTime, setLocalTime] = useState(0);

  // Sync references to avoid stale-closure issues in iframe callback
  const isHostRef = useRef(isHost);
  const onSendWSRef = useRef(onSendWS);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    onSendWSRef.current = onSendWS;
  }, [onSendWS]);

  // Load YouTube IFrame API dynamically
  useEffect(() => {
    // Define the global callback in case it hasn't loaded yet
    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      (window as any).onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else {
      initPlayer();
    }

    function initPlayer() {
      if (playerRef.current) return;
      
      playerRef.current = new (window as any).YT.Player("youtube-player", {
        height: "100%",
        width: "100%",
        videoId: currentTrack?.youtubeId || "",
        playerVars: {
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          origin: window.location.origin,
          autoplay: 1,
          mute: 0
        },
        events: {
          onReady: () => {
            setIsPlayerReady(true);
            playerRef.current.setVolume(volume);
          },
          onStateChange: (event: any) => {
            const YTState = (window as any).YT.PlayerState;
            if (!YTState) return;

            if (isHostRef.current && playerRef.current) {
              if (event.data === YTState.ENDED) {
                // Natural track termination on host: trigger skip command
                onSendWSRef.current({ type: "skip" });
              } else if (event.data === YTState.PAUSED) {
                // Keep server paused state in sync
                const curr = Math.floor(playerRef.current.getCurrentTime() || 0);
                onSendWSRef.current({ type: "pause", currentTime: curr });
              } else if (event.data === YTState.PLAYING) {
                // Keep server resumed state in sync
                const curr = Math.floor(playerRef.current.getCurrentTime() || 0);
                onSendWSRef.current({ type: "resume", currentTime: curr });
              }
            }
          }
        }
      });
    }

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, []);

  // Update volume programmatically
  useEffect(() => {
    if (isPlayerReady && playerRef.current) {
      playerRef.current.setVolume(volume);
    }
  }, [volume, isPlayerReady]);

  // Synchronize dynamic player states when currentTrack or playback requirements edit
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;

    if (!currentTrack) {
      playerRef.current.stopVideo();
      setLocalTime(0);
      return;
    }

    // Try tracking whether the track needs swapping
    let loadedVideoId = "";
    try {
      if (typeof playerRef.current.getVideoUrl === "function") {
        const url = playerRef.current.getVideoUrl();
        const urlMatch = url.match(/[?&]v=([^&#]+)/) || url.match(/embed\/([^&#?]+)/);
        loadedVideoId = urlMatch ? urlMatch[1] : "";
      }
    } catch (e) {
      console.warn("Iframe domain checks:", e);
    }

    if (loadedVideoId !== currentTrack.youtubeId) {
      playerRef.current.loadVideoById({
        videoId: currentTrack.youtubeId,
        startSeconds: playback.currentTime
      });
      setLocalTime(playback.currentTime);
    } else {
      // Correct local states for guests only; the host drives the playback state
      if (!isHost) {
        const diff = Math.abs(playerRef.current.getCurrentTime() - playback.currentTime);
        if (diff > 3) {
          playerRef.current.seekTo(playback.currentTime, true);
          setLocalTime(playback.currentTime);
        }
      }
    }

    // Start playback control based on room synchronization status
    if (playback.isPlaying) {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }

  }, [currentTrack, playback.isPlaying, isPlayerReady, isHost]);

  // Tick progression timer locally to drive UI smoothness
  useEffect(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    if (playback.isPlaying && currentTrack) {
      progressIntervalRef.current = setInterval(() => {
        if (isPlayerReady && playerRef.current) {
          const ytTime = Math.floor(playerRef.current.getCurrentTime() || 0);
          setLocalTime(ytTime);
        } else {
          setLocalTime(prev => Math.min(prev + 1, currentTrack.duration));
        }
      }, 1000);
    }

    return () => clearInterval(progressIntervalRef.current);
  }, [playback.isPlaying, currentTrack, isPlayerReady]);

  // Server Keepalive: Host pings playing duration to force strict lock-step limits for others
  useEffect(() => {
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);

    if (isHost && isPlayerReady && playerRef.current && currentTrack && playback.isPlaying) {
      syncIntervalRef.current = setInterval(() => {
        const currentTime = Math.floor(playerRef.current.getCurrentTime() || 0);
        onSendWS({
          type: "ping_state",
          currentTime,
          isPlaying: true
        });
      }, 4000);
    }

    return () => clearInterval(syncIntervalRef.current);
  }, [isHost, isPlayerReady, currentTrack, playback.isPlaying]);

  // Periodically check and correct drift dynamically (including when coming out of background or minimized state)
  useEffect(() => {
    // HOST should NEVER drift-correct to the server estimates, as the host is the sole source of truth!
    if (isHost || !isPlayerReady || !playerRef.current || !currentTrack || !playback.isPlaying) return;

    const driftCheckInterval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
        const localYTTime = playerRef.current.getCurrentTime() || 0;
        // Calculate current server authoritative elapsed time
        const elapsedSinceLastUpdate = (Date.now() - playback.lastUpdated) / 1000;
        const serverEstTime = playback.currentTime + elapsedSinceLastUpdate;

        const drift = Math.abs(localYTTime - serverEstTime);
        // If drift is too large (more than 3 seconds), seek to the correct server estimation time
        if (drift > 3 && serverEstTime < currentTrack.duration) {
          playerRef.current.seekTo(serverEstTime, true);
          setLocalTime(serverEstTime);
        }
      }
    }, 2000); // Check every 2 seconds to make sure minimize/inactive state recovers instantly

    return () => clearInterval(driftCheckInterval);
  }, [isHost, isPlayerReady, currentTrack, playback.isPlaying, playback.currentTime, playback.lastUpdated]);

  // Interaction controls
  const handleTogglePlay = () => {
    if (!isHost) return;
    if (playback.isPlaying) {
      onSendWS({ type: "pause", currentTime: localTime });
    } else {
      onSendWS({ type: "resume", currentTime: localTime });
    }
  };

  const handleSkip = () => {
    if (isHost) {
      onSendWS({ type: "skip" });
    } else {
      onSendWS({ type: "vote_skip" });
    }
  };

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost) return;
    const targetSeconds = Number(e.target.value);
    setLocalTime(targetSeconds);
    if (playerRef.current && isPlayerReady) {
      playerRef.current.seekTo(targetSeconds, true);
    }
    onSendWS({ type: "seek", currentTime: targetSeconds });
  };

  // Skip votes checks skipped - vote to skip is disabled
  // Time labels parse (e.g. 180 -> "3:00")
  const formatTime = (secs: number) => {
    const min = Math.floor(secs / 60);
    const sec = Math.floor(secs % 60);
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  // Dynamic visual soundbars
  const activeSoundBars = Array.from({ length: 18 }, (_, k) => k);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 glow-purple transition-all duration-300 relative overflow-hidden">
      {/* Dynamic Soundwave Background visualization */}
      {playback.isPlaying && currentTrack && (
        <div className="absolute top-2 right-4 flex items-end gap-1 h-8 opacity-30 select-none">
          {activeSoundBars.map(index => {
            const delayVal = (index * 0.15).toFixed(2);
            return (
              <span
                key={index}
                style={{
                  animation: `spin-slow 1.2s ease-in-out infinite alternate`,
                  animationDelay: `${delayVal}s`,
                  height: `${5 + Math.random() * 25}px`,
                }}
                className="w-[1.5px] bg-purple-500 rounded-full"
              />
            );
          })}
        </div>
      )}

      {/* Embedded YouTube Target Node - positioned offscreen when hidden to bypass Youtube player 200px sizing limits */}
      <div 
        className={`bg-black rounded-lg overflow-hidden transition-all duration-300 ${
          showVideo 
            ? "w-full aspect-video mb-4 relative z-10" 
            : "fixed -left-[9999px] -top-[9999px] w-[320px] h-[180px] pointer-events-none"
        }`}
      >
        <div id="youtube-player" className="w-full h-full" />
      </div>

      {!currentTrack ? (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
          <div className="w-16 h-16 bg-neutral-950 border border-neutral-800 rounded-full flex items-center justify-center animate-pulse">
            <Radio className="w-6 h-6 text-neutral-600" />
          </div>
          <div>
            <h3 className="font-display font-medium text-neutral-200">The Room is Silent</h3>
            <p className="text-xs text-neutral-500 max-w-xs mt-1">
              Suggest list items below by typing or searching with AI to initiate synchronized grooves!
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Main info panel */}
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Vinyl record custom visualizer */}
            <div className="relative">
              <div 
                className={`w-28 h-28 bg-neutral-950 rounded-full border-[6px] border-neutral-800 relative z-10 flex items-center justify-center group overflow-hidden ${
                  playback.isPlaying ? "animate-spin-slow glow-purple-active" : ""
                }`}
              >
                {/* Visual grooves */}
                <div className="absolute inset-2 rounded-full border border-neutral-900/40" />
                <div className="absolute inset-4 rounded-full border border-neutral-900/60" />
                <div className="absolute inset-6 rounded-full border border-neutral-900/80" />
                
                {/* Thumbnail insert */}
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-neutral-900/90 bg-neutral-900 flex items-center justify-center z-10">
                  <img
                    src={currentTrack.thumbnail || `https://img.youtube.com/vi/${currentTrack.youtubeId}/mqdefault.jpg`}
                    alt={currentTrack.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
                {/* Centrally centered pin */}
                <div className="absolute w-3 h-3 bg-neutral-900 rounded-full border border-neutral-800 z-20 flex justify-center items-center">
                  <div className="w-1.5 h-1.5 bg-neutral-950 rounded-full" />
                </div>
              </div>
            </div>

            {/* Title & metadata info */}
            <div className="flex-1 text-center md:text-left min-w-0">
              <span className="text-[10px] font-mono font-medium text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Now Grooving
              </span>
              <h2 className="text-lg font-semibold text-neutral-100 truncate mt-2 leading-snug">
                {currentTrack.title}
              </h2>
              <p className="text-sm text-neutral-400 font-light mt-0.5 truncate uppercase tracking-wide">
                by {currentTrack.artist}
              </p>
              <p className="text-[11px] text-neutral-500 font-mono mt-1.5 flex items-center justify-center md:justify-start gap-1">
                <span>Introduced by:</span>
                <span className="text-neutral-300 font-medium">{currentTrack.addedByName}</span>
              </p>
            </div>
          </div>

          {/* Player controls dashboard */}
          <div className="space-y-3 pt-3 border-t border-neutral-800/60">
            {/* Slider with timeline controls */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500">
                <span>{formatTime(localTime)}</span>
                <span>{formatTime(currentTrack.duration)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={currentTrack.duration}
                disabled={!isHost}
                value={localTime}
                onChange={handleTimelineChange}
                className="w-full h-1 bg-neutral-800 accent-purple-500 rounded-lg cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed"
              />
            </div>

            {/* Play, pause, skip toolbar details */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-3">
                {/* Lock-status warning icon indicator */}
                <span className="text-[10px] font-mono font-semibold tracking-wider text-neutral-500 bg-neutral-950 px-3 py-1 rounded-full border border-neutral-800 flex items-center gap-1.5 uppercase">
                  <span className={`w-2 h-2 rounded-full ${isHost ? "bg-purple-500" : "bg-emerald-500"}`} />
                  {isHost ? "Host Active" : "Synced"}
                </span>

                {/* Show/Hide active video output frame */}
                <button
                  onClick={() => setShowVideo(!showVideo)}
                  className="p-1 px-2.5 bg-neutral-800 hover:bg-neutral-700/80 rounded-lg text-[10px] font-mono font-medium text-neutral-300 flex items-center gap-1.5 border border-neutral-700/40"
                >
                  {showVideo ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {showVideo ? "Hide Frame" : "Show Frame"}
                </button>
              </div>

              {/* Core player knobs */}
              <div className="flex items-center gap-3">
                {/* Host play toggle controls */}
                {isHost ? (
                  <button
                    onClick={handleTogglePlay}
                    className="w-10 h-10 bg-purple-600 hover:bg-purple-500 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 text-white"
                  >
                    {playback.isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                  </button>
                ) : null}

                 {/* Skip Controls (Exclusive for the active Host) */}
                {isHost && (
                  <button
                    onClick={handleSkip}
                    title="Skip Current Track"
                    className="w-10 h-10 bg-neutral-800 hover:bg-neutral-700 hover:text-white rounded-full flex items-center justify-center transition-colors text-neutral-300 border border-neutral-700/60 cursor-pointer"
                  >
                    <SkipForward className="w-5 h-5 fill-current" />
                  </button>
                )}
              </div>

              {/* Speaker Volume bar (Local client only control) */}
              <div className="flex items-center gap-2 bg-neutral-950 p-2 rounded-xl border border-neutral-800/60 w-36">
                <Volume2 className="w-3.5 h-3.5 text-neutral-500" />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-full h-1 bg-neutral-800 accent-neutral-400 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
