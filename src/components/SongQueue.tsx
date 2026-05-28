import { useState, useEffect, useRef } from "react";
import { ArrowUp, ArrowDown, Trash2, Calendar, Disc, ListMusic, History } from "lucide-react";
import { Room, Track } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface SongQueueProps {
  room: Room;
  userId: string;
  isHost: boolean;
  onSendWS: (msg: any) => void;
}

type ActiveTab = "queue" | "history";

export default function SongQueue({ room, userId, isHost, onSendWS }: SongQueueProps) {
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
        borderColor: shouldHighlight ? "rgb(147, 51, 234)" : "rgb(38, 38, 38)",
        boxShadow: shouldHighlight ? "0 0 25px rgba(147, 51, 234, 0.3)" : "none"
      }}
      transition={{ duration: 0.3 }}
      className="bg-neutral-900 border rounded-2xl flex flex-col overflow-hidden h-[460px] relative font-sans"
    >
      {/* Tabs segment */}
      <div className="flex border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-xl relative z-10">
        <button
          onClick={() => setActiveTab("queue")}
          className={`flex-1 py-3.5 px-4 font-semibold text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === "queue"
              ? "text-purple-400 border-b-2 border-purple-500 bg-purple-500/5"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <ListMusic className="w-4 h-4" />
          <span>Queue List</span>
          <span className="bg-neutral-800 px-2 py-0.5 rounded-full text-[10px] font-bold text-neutral-400">
            {queue.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-3.5 px-4 font-semibold text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === "history"
              ? "text-purple-400 border-b-2 border-purple-500 bg-purple-500/5"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Groove History</span>
          <span className="bg-neutral-800 px-2 py-0.5 rounded-full text-[10px] font-bold text-neutral-400">
            {history.length}
          </span>
        </button>
      </div>

      {/* Pane Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-neutral-950/20">
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
                  <div className="w-12 h-12 bg-neutral-900 border border-neutral-800/80 rounded-full flex items-center justify-center">
                    <Disc className="w-5 h-5 text-neutral-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-neutral-400">Queue is Clear</h4>
                    <p className="text-[11px] text-neutral-600 mt-0.5">
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
                      className="flex items-center justify-between p-3.5 bg-neutral-900/40 hover:bg-neutral-900 border border-neutral-800/40 rounded-xl gap-4 transition-colors"
                    >
                      {/* Left: Thumbnail & track titles */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <img
                            src={track.thumbnail || `https://img.youtube.com/vi/${track.youtubeId}/mqdefault.jpg`}
                            alt={track.title}
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 object-cover rounded-lg border border-neutral-800 bg-neutral-900 shadow-md"
                          />
                          <span className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-neutral-900 border border-neutral-800 text-[10px] font-mono font-bold text-neutral-400 rounded-full flex items-center justify-center">
                            {i + 1}
                          </span>
                        </div>
                        <div className="text-left min-w-0">
                          <h3 className="text-xs font-semibold text-neutral-200 truncate pr-2">
                            {track.title}
                          </h3>
                          <p className="text-[10px] text-neutral-500 font-light truncate mt-0.5">
                            {track.artist} • {formatDuration(track.duration)}
                          </p>
                          <p className="text-[9px] font-mono text-purple-400 bg-purple-500/5 border border-purple-500/10 rounded-md px-1.5 py-0.5 inline-block mt-1">
                            Shared by {track.addedByName}
                          </p>
                        </div>
                      </div>

                      {/* Right: Score Controls & deletion */}
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Upvote/Downvote interface */}
                        <div className="flex items-center bg-neutral-950 px-2 py-1.5 rounded-lg border border-neutral-800/80 gap-1 select-none">
                          <button
                            onClick={() => handleVote(track.id, hasUpvoted ? null : "up")}
                            className={`p-1 rounded-md transition-colors cursor-pointer ${
                              hasUpvoted
                                ? "text-purple-400 bg-purple-500/10"
                                : "text-neutral-550 hover:text-neutral-300"
                            }`}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          
                          <span className={`text-[11px] font-mono font-bold w-6 text-center ${
                            track.score > 0 
                              ? "text-purple-400" 
                              : track.score < 0 
                                ? "text-rose-400" 
                                : "text-neutral-500"
                          }`}>
                            {track.score > 0 ? `+${track.score}` : track.score}
                          </span>

                          <button
                            onClick={() => handleVote(track.id, hasDownvoted ? null : "down")}
                            className={`p-1 rounded-md transition-colors cursor-pointer ${
                              hasDownvoted
                                ? "text-rose-400 bg-rose-500/10"
                                : "text-neutral-550 hover:text-neutral-300"
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
                            className="p-2 hover:bg-rose-500/5 text-neutral-500 hover:text-rose-400 border border-transparent hover:border-rose-500/10 rounded-lg transition-all cursor-pointer"
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
                  <div className="w-12 h-12 bg-neutral-900 border border-neutral-800/80 rounded-full flex items-center justify-center">
                    <History className="w-5 h-5 text-neutral-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-neutral-400">No played tracks found</h4>
                    <p className="text-[11px] text-neutral-600 mt-0.5">
                      Songs conclude their playback cycle to transition here.
                    </p>
                  </div>
                </div>
              ) : (
                history.map((track, index) => (
                  <div
                    key={track.id + "_hist_" + index}
                    className="flex items-center justify-between p-3 bg-neutral-950/40 border border-neutral-900 rounded-xl gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <img
                        src={track.thumbnail || `https://img.youtube.com/vi/${track.youtubeId}/mqdefault.jpg`}
                        alt={track.title}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 object-cover rounded-lg border border-neutral-950 bg-neutral-900 opacity-60"
                      />
                      <div className="text-left min-w-0">
                        <h4 className="text-xs font-medium text-neutral-400 truncate pr-2">
                          {track.title}
                        </h4>
                        <p className="text-[10px] text-neutral-600 truncate mt-0.5">
                          by {track.artist} • {formatDuration(track.duration)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 px-2 py-1 rounded-lg text-[9px] font-mono text-neutral-500 uppercase tracking-wider shrink-0 select-none">
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
