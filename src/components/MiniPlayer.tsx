import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipForward, Volume2, Maximize2, Minimize2, Radio } from "lucide-react";
import { Room, Track, PlaybackState } from "../types";
import { motion } from "motion/react";

interface MiniPlayerProps {
  room: Room;
  userId: string;
  isHost: boolean;
  onSendWS: (msg: any) => void;
  theme?: "dark" | "light";
}

export default function MiniPlayer({ room, userId, isHost, onSendWS, theme }: MiniPlayerProps) {
  const { currentTrack, playback, skipVotes, participants } = room;
  const isDJ = isHost || (room.djIds && room.djIds.includes(userId)) ? true : false;

  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);
  const syncIntervalRef = useRef<any>(null);

  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [volume, setVolume] = useState(50);
  const [localTime, setLocalTime] = useState(0);

  const lastLoadedTrackIdRef = useRef<string | null>(null);
  const isSwappingTrackRef = useRef<boolean>(false);

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
                if (isSwappingTrackRef.current) return;
                // Keep server paused state in sync
                const curr = Math.floor(playerRef.current.getCurrentTime() || 0);
                onSendWSRef.current({ type: "pause", currentTime: curr });
              } else if (event.data === YTState.PLAYING) {
                if (isSwappingTrackRef.current) return;
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
      isSwappingTrackRef.current = true;
      lastLoadedTrackIdRef.current = currentTrack.id;
      const startSecs = playback.currentTime < 5 ? 0 : playback.currentTime;
      playerRef.current.loadVideoById({
        videoId: currentTrack.youtubeId,
        startSeconds: startSecs
      });
      setLocalTime(startSecs);
      setTimeout(() => {
        isSwappingTrackRef.current = false;
      }, 3000);
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

        // Skip drift check at the very beginning of the song to allow clean buffering
        if (localYTTime < 6) return;

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
    if (!isDJ) return;
    if (playback.isPlaying) {
      onSendWS({ type: "pause", currentTime: localTime });
    } else {
      onSendWS({ type: "resume", currentTime: localTime });
    }
  };

  const handleSkip = () => {
    if (isDJ) {
      onSendWS({ type: "skip" });
    } else {
      onSendWS({ type: "vote_skip" });
    }
  };

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isDJ) return;
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
  const isDark = theme !== "light";

  return (
    <div className={`p-6 rounded-3xl transition-all duration-350 relative overflow-hidden ${
      isDark 
        ? "bg-[#0c1122]/75 border border-[#1b2542] shadow-xl shadow-[0_15px_35px_rgba(0,0,0,0.5)] text-neutral-100" 
        : "bg-white border border-[#cad9ef] shadow-xl shadow-[0_15px_35px_rgba(30,41,59,0.05)] text-neutral-800"
    }`}>
      {/* Dynamic Soundwave Background visualization */}
      {playback.isPlaying && currentTrack && (
        <div className="absolute top-3 right-5 flex items-end gap-[2px] h-8 opacity-30 select-none">
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
                className={`w-[2px] rounded-full ${isDark ? "bg-[#22d3ee]" : "bg-cyan-600"}`}
              />
            );
          })}
        </div>
      )}

      {/* Embedded YouTube Target Node */}
      <div 
        className={`bg-black rounded-lg overflow-hidden transition-all duration-300 ${
          showVideo 
            ? `w-full aspect-video mb-4 relative z-10 border ${isDark ? "border-[#1b2542]" : "border-[#cad9ef]"}` 
            : "fixed -left-[9999px] -top-[9999px] w-[320px] h-[180px] pointer-events-none"
        }`}
      >
        <div id="youtube-player" className="w-full h-full" />
      </div>

      {!currentTrack ? (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center animate-pulse border ${
            isDark ? "bg-[#05070c] border-[#151c31]" : "bg-[#f5f8fd] border-[#bfd3ec]"
          }`}>
            <Radio className={`w-6 h-6 ${isDark ? "text-cyan-500/40" : "text-cyan-600/40"}`} />
          </div>
          <div>
            <h3 className={`font-display font-bold ${isDark ? "text-[#e2e8f0]" : "text-neutral-800"}`}>The Room is Silent</h3>
            <p className={`text-xs max-w-xs mt-1 leading-relaxed ${isDark ? "text-[#526490]" : "text-[#5e77ad]"}`}>
              Suggest list items below by typing or searching to initiate synchronized grooves!
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
                className={`w-28 h-28 rounded-full border-[6px] relative z-10 flex items-center justify-center group overflow-hidden transition-all ${
                  isDark 
                    ? `bg-[#04060b] border-[#18233f] ${playback.isPlaying ? "animate-spin-slow shadow-[0_0_35px_rgba(6,182,212,0.25)]" : ""}`
                    : `bg-[#1e293b] border-[#475569] ${playback.isPlaying ? "animate-spin-slow shadow-[0_0_35px_rgba(99,102,241,0.15)]" : ""}`
                }`}
              >
                {/* Visual grooves */}
                <div className={`absolute inset-2 rounded-full border ${isDark ? "border-[#0d1326]/30" : "border-[#000000]/10"}`} />
                <div className={`absolute inset-4 rounded-full border ${isDark ? "border-[#0d1326]/40" : "border-[#000000]/15"}`} />
                <div className={`absolute inset-6 rounded-full border ${isDark ? "border-[#0d1326]/60" : "border-[#000000]/20"}`} />
                
                {/* Thumbnail insert */}
                <div className={`w-14 h-14 rounded-full overflow-hidden border-2 flex items-center justify-center z-10 ${
                  isDark ? "border-[#090e1c] bg-[#090e1c]" : "border-[#334155] bg-neutral-900"
                }`}>
                  <img
                    src={currentTrack.thumbnail || `https://img.youtube.com/vi/${currentTrack.youtubeId}/mqdefault.jpg`}
                    alt={currentTrack.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
                {/* Centrally centered pin */}
                <div className={`absolute w-3 h-3 rounded-full border z-20 flex justify-center items-center ${
                  isDark ? "bg-[#05070c] border-[#1d2745]" : "bg-[#f1f5f9] border-[#cbd5e1]"
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isDark ? "bg-cyan-400" : "bg-cyan-600"}`} />
                </div>
              </div>
            </div>

            {/* Title & metadata info */}
            <div className="flex-1 text-center md:text-left min-w-0">
              <span className={`text-[10px] font-mono font-bold border px-3 py-1 rounded-full uppercase tracking-wider ${
                isDark 
                  ? "text-cyan-400 bg-cyan-950/40 border-cyan-500/20" 
                  : "text-cyan-700 bg-cyan-50 border-cyan-200"
              }`}>
                Now Grooving
              </span>
              <h2 className={`text-lg font-bold truncate mt-3.5 leading-snug tracking-tight ${isDark ? "text-neutral-100" : "text-neutral-800"}`}>
                {currentTrack.title}
              </h2>
              <p className={`text-xs font-bold mt-0.5 truncate uppercase tracking-widest font-mono ${isDark ? "text-[#8ea0d2]" : "text-indigo-600"}`}>
                by {currentTrack.artist}
              </p>
              <p className={`text-[10px] font-mono mt-2 flex items-center justify-center md:justify-start gap-1 ${isDark ? "text-[#4e5f8a]" : "text-[#5e77ad]"}`}>
                <span>Introduced by:</span>
                <span className={`font-bold ${isDark ? "text-cyan-400/90" : "text-cyan-600"}`}>{currentTrack.addedByName}</span>
              </p>
            </div>
          </div>

          {/* Player controls dashboard */}
          <div className={`space-y-3 pt-4 border-t ${isDark ? "border-[#141b31]" : "border-[#e0ebf7]"}`}>
            {/* Slider with timeline controls */}
            <div className="space-y-1">
              <div className={`flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-widest ${
                isDark ? "text-cyan-500/80" : "text-cyan-600"
              }`}>
                <span>{formatTime(localTime)}</span>
                <span>{formatTime(currentTrack.duration)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={currentTrack.duration}
                disabled={!isDJ}
                value={localTime}
                onChange={handleTimelineChange}
                className={`w-full h-1.5 rounded-lg cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed ${
                  isDark ? "bg-[#141b31] accent-cyan-400" : "bg-[#e2e8f0] accent-cyan-600"
                }`}
              />
            </div>

            {/* Play, pause, skip toolbar details */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-3">
                {/* Lock-status warning icon indicator */}
                <span className={`text-[10px] font-mono font-bold tracking-widest border px-3 py-1.5 rounded-xl flex items-center gap-2 uppercase ${
                  isDark 
                    ? "text-[#8ea0d2] bg-[#05070c] border-[#1c2745]" 
                    : "text-indigo-950 bg-[#f5f8fd] border-[#bfd3ec]"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    isHost 
                      ? (isDark ? "bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" : "bg-cyan-600") 
                      : isDJ 
                      ? "bg-emerald-500 animate-pulse" 
                      : (isDark ? "bg-[#4e5f8a]" : "bg-neutral-350")
                  }`} />
                  {isHost ? "Host Active" : isDJ ? "DJ Link" : "Synced"}
                </span>

                {/* Show/Hide active video output frame */}
                <button
                  onClick={() => setShowVideo(!showVideo)}
                  className={`p-1 px-3 rounded-xl text-[10px] font-mono font-bold flex items-center gap-1.5 border cursor-pointer transition-all ${
                    isDark 
                      ? "bg-[#0b0f1d] hover:bg-[#121931]/80 text-[#8ea0d2] border-[#1c2744]" 
                      : "bg-[#f5f8fd] hover:bg-neutral-100 text-indigo-700 border-[#bfd3ec] shadow-sm"
                  }`}
                >
                  {showVideo ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {showVideo ? "Hide Frame" : "Show Frame"}
                </button>
              </div>

              {/* Core player knobs */}
              <div className="flex items-center gap-3">
                {/* Host or DJ play toggle controls */}
                {isDJ ? (
                  <button
                    onClick={handleTogglePlay}
                    className="w-11 h-11 bg-gradient-to-tr from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-cyan-950/20 transition-all hover:scale-105 active:scale-95 text-white cursor-pointer"
                  >
                    {playback.isPlaying ? <Pause className="w-5 h-5 fill-white text-white" /> : <Play className="w-5 h-5 fill-white text-white ml-0.5" />}
                  </button>
                ) : null}

                 {/* Skip Controls (Available for Host or designated DJ) */}
                {isDJ && (
                  <button
                    onClick={handleSkip}
                    title="Skip Current Track"
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
                      isDark 
                        ? "bg-[#0b0f1d] hover:bg-[#121931] hover:text-cyan-300 border-[#1c2744] text-cyan-400" 
                        : "bg-[#f5f8fd] hover:bg-neutral-100 hover:text-indigo-600 border-[#bfd3ec] text-indigo-600 shadow-sm"
                    }`}
                  >
                    <SkipForward className="w-5 h-5 fill-current" />
                  </button>
                )}
              </div>

              {/* Speaker Volume bar (Local client only control) */}
              <div className={`flex items-center gap-2 p-2.5 rounded-xl border w-36 shadow-inner ${
                isDark ? "bg-[#05070c] border-[#1c2745]" : "bg-[#f5f8fd] border-[#bfd3ec]"
              }`}>
                <Volume2 className={`w-3.5 h-3.5 ${isDark ? "text-[#4e5f8a]" : "text-[#7b92bf]"}`} />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className={`w-full h-1 rounded-lg cursor-pointer ${
                    isDark ? "bg-[#141b31] accent-cyan-400" : "bg-[#e2e8f0] accent-indigo-500"
                  }`}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
