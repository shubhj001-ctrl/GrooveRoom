import { useState, useEffect, useRef } from "react";
import { ArrowUp, ArrowDown, Trash2, Calendar, Disc, ListMusic, History } from "lucide-react";
import { Room, Track } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface SongQueueProps {
  room: Room;
  userId: string;
  isHost: boolean;
  onSendWS: (msg: any) => void;
  theme?: "dark" | "light";
}

type ActiveTab = "queue" | "history";

export default function SongQueue({ room, userId, isHost, onSendWS, theme }: SongQueueProps) {
  const { queue, history } = room;
  const [activeTab, setActiveTab] = useState<ActiveTab>("queue");

  const [shouldHighlight, setShouldHighlight] = useState(false);
  const prevQueueIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const currentIds = queue.map(t => t.id);
    const hasNewItem = currentIds.some(id => !prevQueueIdsRef.current.includes(id));
    if (hasNewItem && prevQueueIdsRef.current.length > 0) {
      setShouldHighlight(true);
      const timer = setTimeout(() => {
        setShouldHighlight(false);
      }, 2000);
      prevQueueIdsRef.current = currentIds;
      return () => clearTimeout(timer);
    }
    prevQueueIdsRef.current = currentIds;
  }, [queue]);

  const isDark = theme !== "light";

  // Interaction handlers
  const handleVote = (trackId: string, currentVote: "up" | "down" | null) => {
    let value = 0;
    if (currentVote === "up") value = 1;
    if (currentVote === "down") value = -1;

    onSendWS({
      type: "vote_track",
      trackId,
      value
    });
  };

  const handleRemove = (trackId: string) => {
    onSendWS({
      type: "remove_track",
      trackId
    });
  };

  const formatDuration = (secs: number) => {
    const min = Math.floor(secs / 60);
    const sec = Math.floor(secs % 60);
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  return (
    <motion.div
      animate={{
        borderColor: shouldHighlight 
          ? "rgb(34, 211, 238)" 
          : (isDark ? "rgb(27, 37, 66)" : "rgb(202, 217, 239)"),
        boxShadow: shouldHighlight ? "0 0 25px rgba(34, 211, 238, 0.25)" : "none"
      }}
      transition={{ duration: 0.3 }}
      className={`border rounded-3xl flex flex-col overflow-hidden h-[460px] relative font-sans shadow-xl transition-all duration-300 ${
        isDark 
          ? "bg-[#0c1122]/75 border-[#1b2542] text-neutral-100" 
          : "bg-white border-[#cad9ef] text-neutral-800 shadow-xl shadow-[0_15px_35px_rgba(30,41,59,0.05)]"
      }`}
    >
      {/* Tabs segment */}
      <div className={`flex border-b relative z-10 transition-colors duration-300 ${
        isDark 
          ? "border-[#1b2542] bg-[#0d1326]/90 backdrop-blur-xl" 
          : "border-[#bfd3ec] bg-[#f5f8fd]"
      }`}>
        <button
          onClick={() => setActiveTab("queue")}
          className={`flex-1 py-3.5 px-4 font-bold text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === "queue"
              ? (isDark 
                ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5" 
                : "text-cyan-700 border-b-2 border-cyan-600 bg-cyan-100/20")
              : (isDark 
                ? "text-[#4e5f8a] hover:text-cyan-300" 
                : "text-[#5e77ad] hover:text-cyan-600")
          }`}
        >
          <ListMusic className="w-4 h-4" />
          <span>Queue List</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors duration-300 ${
            isDark 
              ? "bg-[#131b31] border-[#1c2745] text-cyan-400" 
              : "bg-[#e6effc] border-[#bfd3ec] text-cyan-700"
          }`}>
            {queue.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-3.5 px-4 font-bold text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === "history"
              ? (isDark 
                ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5" 
                : "text-cyan-700 border-b-2 border-cyan-600 bg-cyan-100/20")
              : (isDark 
                ? "text-[#4e5f8a] hover:text-cyan-300" 
                : "text-[#5e77ad] hover:text-cyan-600")
          }`}
        >
          <History className="w-4 h-4" />
          <span>Groove History</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors duration-300 ${
            isDark 
              ? "bg-[#131b31] border-[#1c2745] text-cyan-400" 
              : "bg-[#e6effc] border-[#bfd3ec] text-cyan-700"
          }`}>
            {history.length}
          </span>
        </button>
      </div>

      {/* Pane Content */}
      <div className={`flex-1 overflow-y-auto p-4 transition-colors duration-300 ${
        isDark ? "bg-[#05070c]/20" : "bg-[#f5f8fd]/40"
      }`}>
        <AnimatePresence mode="wait">
          {activeTab === "queue" ? (
            <motion.div
              key="queue"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center space-y-3 h-full">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-colors duration-300 ${
                    isDark ? "bg-[#080b14] border-[#151d33]" : "bg-white border-[#cad9ef] shadow-sm"
                  }`}>
                    <Disc className={`w-5 h-5 animate-spin-slow ${isDark ? "text-cyan-600/50" : "text-cyan-600/70"}`} />
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold ${isDark ? "text-[#e2e8f0]" : "text-neutral-800"}`}>Queue is Clear</h4>
                    <p className={`text-[11px] mt-0.5 leading-relaxed font-semibold ${isDark ? "text-[#526490]" : "text-[#5e77ad]"}`}>
                      Suggest songs using the search console below.
                    </p>
                  </div>
                </div>
              ) : (
                queue.map((track, i) => {
                  const hasUpvoted = track.upvotes.includes(userId);
                  const hasDownvoted = track.downvotes.includes(userId);

                  return (
                    <motion.div
                      key={track.id}
                      layoutId={track.id}
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex items-center justify-between p-3 rounded-2xl gap-4 border transition-colors duration-300 ${
                        isDark 
                          ? "bg-[#080c16]/70 hover:bg-[#0c1122]/90 border-[#141b31]" 
                          : "bg-white hover:bg-neutral-50 border-[#cad9ef] shadow-sm"
                      }`}
                    >
                      {/* Left: Thumbnail & track titles */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <img
                            src={track.thumbnail || `https://img.youtube.com/vi/${track.youtubeId}/mqdefault.jpg`}
                            alt={track.title}
                            referrerPolicy="no-referrer"
                            className={`w-11 h-11 object-cover rounded-xl border shadow-md transition-colors duration-300 ${
                              isDark ? "border-[#141e35] bg-[#05070c]" : "border-[#ceddf0] bg-white"
                            }`}
                          />
                          <span className={`absolute -top-1.5 -left-1.5 w-5 h-5 text-[10px] font-mono font-bold rounded-full flex items-center justify-center border transition-colors duration-300 ${
                            isDark 
                              ? "bg-[#05070c] border-[#1c2745] text-cyan-400" 
                              : "bg-[#f5f8fd] border-[#bfd3ec] text-[#0891b2]"
                          }`}>
                            {i + 1}
                          </span>
                        </div>
                        <div className="text-left min-w-0">
                          <h3 className={`text-xs font-bold truncate pr-2 leading-tight ${isDark ? "text-neutral-200" : "text-neutral-800"}`}>
                            {track.title}
                          </h3>
                          <p className={`text-[10px] font-bold truncate mt-0.5 ${isDark ? "text-[#526490]" : "text-[#5e77ad]"}`}>
                            {track.artist} • {formatDuration(track.duration)}
                          </p>
                          <p className={`text-[9px] font-mono font-bold rounded-md px-1.5 py-0.5 inline-block mt-1 border transition-colors duration-300 ${
                            isDark 
                              ? "text-cyan-400 bg-cyan-950/30 border-cyan-500/10" 
                              : "text-cyan-750 bg-cyan-50/70 border-cyan-200"
                          }`}>
                            Shared by {track.addedByName}
                          </p>
                        </div>
                      </div>

                      {/* Right: Score Controls & deletion */}
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Upvote/Downvote interface */}
                        <div className={`flex items-center px-2 py-1.5 rounded-xl border gap-1 select-none transition-colors duration-300 ${
                          isDark ? "bg-[#04060b] border-[#141b31]" : "bg-[#f5f8fd] border-[#bfd3ec]"
                        }`}>
                          <button
                            onClick={() => handleVote(track.id, hasUpvoted ? null : "up")}
                            className={`p-1 rounded-md transition-all cursor-pointer ${
                              hasUpvoted
                                ? (isDark ? "text-cyan-400 bg-cyan-500/10" : "text-cyan-600 bg-cyan-100/80")
                                : (isDark ? "text-[#4e5f8a] hover:text-cyan-300" : "text-[#5e77ad] hover:text-cyan-600")
                            }`}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          
                          <span className={`text-[11px] font-mono font-bold w-6 text-center transition-colors duration-300 ${
                            track.score > 0 
                              ? (isDark ? "text-cyan-400" : "text-cyan-650") 
                              : track.score < 0 
                                ? "text-rose-450" 
                                : (isDark ? "text-[#4e5f8a]" : "text-[#5e77ad]")
                          }`}>
                            {track.score > 0 ? `+${track.score}` : track.score}
                          </span>

                          <button
                            onClick={() => handleVote(track.id, hasDownvoted ? null : "down")}
                            className={`p-1 rounded-md transition-all cursor-pointer ${
                              hasDownvoted
                                ? (isDark ? "text-rose-400 bg-rose-500/10" : "text-rose-600 bg-rose-100/85")
                                : (isDark ? "text-[#4e5f8a] hover:text-cyan-300" : "text-[#5e77ad] hover:text-cyan-600")
                            }`}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Trash Button - Only Host of the session can remove songs */}
                        {isHost && (
                          <button
                            onClick={() => handleRemove(track.id)}
                            title="Remove song"
                            className={`p-2 border rounded-xl transition-all cursor-pointer ${
                              isDark 
                                ? "hover:bg-rose-500/5 text-[#4e5f8a] hover:text-rose-400 border-transparent hover:border-rose-500/10" 
                                : "hover:bg-rose-50 text-[#5e77ad] hover:text-rose-600 border-transparent hover:border-rose-200"
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center space-y-3 h-full">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-colors duration-300 ${
                    isDark ? "bg-[#080b14] border-[#151d33]" : "bg-white border-[#cad9ef] shadow-sm"
                  }`}>
                    <History className={`w-5 h-5 ${isDark ? "text-cyan-600/50" : "text-cyan-650"}`} />
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold ${isDark ? "text-[#e2e8f0]" : "text-neutral-800"}`}>No played tracks found</h4>
                    <p className={`text-[11px] mt-0.5 leading-relaxed font-semibold ${isDark ? "text-[#526490]" : "text-[#5e77ad]"}`}>
                      Songs conclude their playback cycle to transition here.
                    </p>
                  </div>
                </div>
              ) : (
                history.map((track, index) => (
                  <div
                    key={track.id + "_hist_" + index}
                    className={`flex items-center justify-between p-3 rounded-2xl gap-4 border transition-colors duration-300 ${
                      isDark 
                        ? "bg-[#05070c]/40 border-[#131a30]" 
                        : "bg-white border-[#cad9ef] shadow-inner"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <img
                        src={track.thumbnail || `https://img.youtube.com/vi/${track.youtubeId}/mqdefault.jpg`}
                        alt={track.title}
                        referrerPolicy="no-referrer"
                        className={`w-10 h-10 object-cover rounded-xl border transition-colors duration-350 ${
                          isDark ? "border-[#1a233b] bg-[#05070c] opacity-60" : "border-[#ceddf0] bg-white opacity-85"
                        }`}
                      />
                      <div className="text-left min-w-0">
                        <h4 className={`text-xs font-bold truncate pr-2 ${isDark ? "text-[#8ea0d2]" : "text-[#2b3a61]"}`}>
                          {track.title}
                        </h4>
                        <p className={`text-[10px] truncate mt-0.5 font-bold ${isDark ? "text-[#4e5f8a]" : "text-[#5e77ad]"}`}>
                          by {track.artist} • {formatDuration(track.duration)}
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 border px-2.5 py-1.5 rounded-xl text-[9px] font-mono font-bold uppercase tracking-widest shrink-0 select-none ${
                      isDark 
                        ? "bg-[#0c1122] border-[#1c2745] text-cyan-400" 
                        : "bg-emerald-50 border-emerald-200 text-emerald-700"
                    }`}>
                      <Calendar className="w-3" /> Done
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
