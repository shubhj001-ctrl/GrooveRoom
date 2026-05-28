import React, { useState, useEffect } from "react";
import { Search, Plus, Loader2, Link } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SearchPanelProps {
  onAddTrack: (track: { title: string; artist: string; youtubeId: string; duration: number; thumbnail: string }) => void;
}

type SearchMode = "search" | "url";

export default function SearchPanel({ onAddTrack }: SearchPanelProps) {
  const [mode, setMode] = useState<SearchMode>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [directUrl, setDirectUrl] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  // Helper: Parses YouTube URL to extract Video ID
  const parseYoutubeId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  // Bypass form manual submissions
  const handleKeywordSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  // Dynamic typing autocomplete debouncer
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setErrorMsg("");
      try {
        const resp = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (!resp.ok) {
          throw new Error("Failed to pull search results.");
        }
        const data = await resp.json();
        setSearchResults(data.results || []);
      } catch (err: any) {
        setErrorMsg(err.message || "An error occurred fetching search results.");
      } finally {
        setIsLoading(false);
      }
    }, 400); // 400ms debounce: highly responsive, safety-conscious

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 2. Direct Add using URL or ID
  const handleDirectAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    let videoId = directUrl.trim();
    if (videoId.includes("youtube.com") || videoId.includes("youtu.be")) {
      const parsed = parseYoutubeId(videoId);
      if (parsed) {
        videoId = parsed;
      } else {
        setErrorMsg("Could not parse YouTube video ID from that link. Try pasting the exact ID.");
        return;
      }
    }

    if (videoId.length !== 11) {
      setErrorMsg("Video ID must be exactly 11 characters.");
      return;
    }

    // Insert track
    onAddTrack({
      title: "Direct Added Song",
      artist: "YouTube Stream",
      youtubeId: videoId,
      duration: 180, // Fallback duration
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    });

    setDirectUrl("");
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col p-5 font-sans relative">
      
      {/* Search Header tabs */}
      <div className="flex border-b border-neutral-800 pb-3 gap-2">
        <button
          onClick={() => { setMode("search"); setErrorMsg(""); }}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            mode === "search" ? "bg-neutral-800 text-neutral-100 font-bold" : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Keyword Search</span>
        </button>

        <button
          onClick={() => { setMode("url"); setErrorMsg(""); }}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            mode === "url" ? "bg-neutral-800 text-neutral-100 font-bold" : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <Link className="w-3.5 h-3.5" />
          <span>Paste URL / ID</span>
        </button>
      </div>

      {/* Pane Areas */}
      <div className="mt-4 flex-1">
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] px-3 animate-pulse py-2 rounded-xl mb-4 text-center">
            {errorMsg}
          </div>
        )}

        {/* 1. Keyword search inputs */}
        {mode === "search" && (
          <div className="space-y-4">
            <form onSubmit={handleKeywordSearch} className="flex gap-2">
              <input
                type="text"
                required
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search favorite songs, artists, live lofi..."
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="bg-purple-600 hover:bg-purple-500 text-white p-2.5 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer text-xs font-medium"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </form>

            {/* List results */}
            <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1">
              {searchResults.length > 0 ? (
                searchResults.map((item) => (
                  <div
                    key={item.youtubeId}
                    className="flex items-center justify-between p-2.5 bg-neutral-950 rounded-xl border border-neutral-800/40"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <img
                        src={item.thumbnail}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-12 h-9 object-cover rounded-md border border-neutral-800 shadow-sm shrink-0"
                      />
                      <div className="text-left min-w-0">
                        <p className="text-xs text-neutral-300 font-semibold truncate">{item.title}</p>
                        <p className="text-[10px] text-neutral-500 truncate mt-0.5">{item.artist}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => onAddTrack(item)}
                      className="p-1 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-sans font-medium flex items-center justify-center gap-1 transition-colors shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3" /> Add
                    </button>
                  </div>
                ))
              ) : searchQuery && !isLoading ? (
                <p className="text-[11px] text-neutral-500 text-center py-6 font-mono">No YouTube streams located. Try another keyword string.</p>
              ) : null}
            </div>
          </div>
        )}

        {/* 2. Paste URL input */}
        {mode === "url" && (
          <form onSubmit={handleDirectAdd} className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={directUrl}
                onChange={(e) => setDirectUrl(e.target.value)}
                placeholder="Paste full YouTube Link or exact 11-char Video ID"
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-500 text-white py-2.5 px-4 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Add Track</span>
              </button>
            </div>
            <p className="text-[10px] text-neutral-500 font-mono leading-relaxed pt-1 select-none">
              💡 Supports standard links (e.g. <span className="text-neutral-400">https://www.youtube.com/watch?v=dQw4w9WgXcQ</span>) or simple shorts & watch ids (e.g. <span className="text-neutral-400">dQw4w9WgXcQ</span>).
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
