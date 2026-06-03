import React, { useState, useEffect } from "react";
import { Search, Plus, Loader2, Link } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SearchPanelProps {
  onAddTrack: (track: { title: string; artist: string; youtubeId: string; duration: number; thumbnail: string }) => void;
  theme?: "dark" | "light";
}

type SearchMode = "search" | "url";

export default function SearchPanel({ onAddTrack, theme }: SearchPanelProps) {
  const [mode, setMode] = useState<SearchMode>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [directUrl, setDirectUrl] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const isDark = theme !== "light";

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
    <div className={`rounded-3xl flex flex-col p-5 font-sans relative transition-all duration-300 ${
      isDark 
        ? "bg-[#0c1122]/75 border border-[#1b2542] shadow-xl text-neutral-100" 
        : "bg-white border border-[#cad9ef] shadow-xl shadow-[0_15px_35px_rgba(30,41,59,0.05)] text-neutral-800"
    }`}>
      
      {/* Search Header tabs */}
      <div className={`flex border-b pb-3 gap-2 ${isDark ? "border-[#1b2542]" : "border-[#e2e8f7]"}`}>
        <button
          onClick={() => { setMode("search"); setErrorMsg(""); }}
          className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-mono uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mode === "search" 
              ? (isDark 
                ? "bg-[#141c30] border border-cyan-500/20 text-cyan-400 font-bold" 
                : "bg-cyan-50 border border-[#bfd3ec] text-cyan-700 font-bold")
              : (isDark 
                ? "text-[#4e5f8a] hover:text-cyan-300" 
                : "text-[#5e77ad] hover:text-cyan-700")
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Keyword Search</span>
        </button>

        <button
          onClick={() => { setMode("url"); setErrorMsg(""); }}
          className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-mono uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mode === "url" 
              ? (isDark 
                ? "bg-[#141c30] border border-cyan-500/20 text-cyan-400 font-bold" 
                : "bg-cyan-50 border border-[#bfd3ec] text-cyan-700 font-bold")
              : (isDark 
                ? "text-[#4e5f8a] hover:text-cyan-300" 
                : "text-[#5e77ad] hover:text-cyan-700")
          }`}
        >
          <Link className="w-3.5 h-3.5" />
          <span>Paste URL / ID</span>
        </button>
      </div>

      {/* Pane Areas */}
      <div className="mt-4 flex-1">
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[11px] px-3 animate-pulse py-2.5 rounded-xl mb-4 text-center font-mono">
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
                className={`flex-1 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 transition-all ${
                  isDark 
                    ? "bg-[#05070c] border border-[#1e2947] text-neutral-200 placeholder-[#3e4f7a] focus:border-cyan-400 focus:ring-cyan-400" 
                    : "bg-[#f5f8fd] border border-[#bfd3ec] text-neutral-900 placeholder-[#7a8da3] focus:border-indigo-500 focus:ring-indigo-500"
                }`}
              />
              <button
                type="submit"
                disabled={isLoading}
                className={`p-2.5 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer text-xs font-bold ${
                  isDark
                    ? "bg-cyan-500 hover:bg-cyan-400 text-[#0a101f]"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                }`}
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
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isDark 
                        ? "bg-[#05070c] border-[#141e35] hover:border-[#1e2947]" 
                        : "bg-[#f8fafd] border-[#bfd3ec] hover:border-indigo-300/60"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <img
                        src={item.thumbnail}
                        alt=""
                        referrerPolicy="no-referrer"
                        className={`w-12 h-9 object-cover rounded-md border shadow-sm shrink-0 ${isDark ? "border-[#1b2542]" : "border-[#bfd3ec]"}`}
                      />
                      <div className="text-left min-w-0">
                        <p className={`text-xs font-bold truncate pr-1 ${isDark ? "text-neutral-200" : "text-neutral-800"}`}>{item.title}</p>
                        <p className={`text-[10px] truncate mt-0.5 ${isDark ? "text-[#4e5f8a]" : "text-[#5e77ad] font-medium"}`}>{item.artist}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => onAddTrack(item)}
                      className="p-1 px-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg text-[10px] font-sans font-bold flex items-center justify-center gap-1 transition-colors shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3 text-white" /> Add
                    </button>
                  </div>
                ))
              ) : searchQuery && !isLoading ? (
                <p className={`text-[11px] text-center py-6 font-mono font-bold ${isDark ? "text-[#4e5f8a]" : "text-[#5e77ad]"}`}>No YouTube streams located. Try another keyword string.</p>
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
                className={`flex-1 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 transition-all ${
                  isDark 
                    ? "bg-[#05070c] border border-[#1e2947] text-neutral-200 placeholder-[#3e4f7a] focus:border-cyan-400 focus:ring-cyan-400" 
                    : "bg-[#f5f8fd] border border-[#bfd3ec] text-neutral-900 placeholder-[#7a8da3] focus:border-indigo-500 focus:ring-indigo-500"
                }`}
              />
              <button
                type="submit"
                className={`py-2.5 px-4 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 transition-colors cursor-pointer ${
                  isDark
                    ? "bg-cyan-500 hover:bg-cyan-400 text-[#0a101f]"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                }`}
              >
                <span>Add Track</span>
              </button>
            </div>
            <p className={`text-[10px] font-mono leading-relaxed pt-1 select-none font-bold ${isDark ? "text-[#4e5f8a]" : "text-[#5e77ad]"}`}>
              💡 Supports standard links (e.g. <span className={isDark ? "text-cyan-400/80" : "text-cyan-600"}>https://www.youtube.com/watch?v=dQw4w9WgXcQ</span>) or simple shorts & watch ids (e.g. <span className={isDark ? "text-cyan-400/80" : "text-cyan-600"}>dQw4w9WgXcQ</span>).
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
