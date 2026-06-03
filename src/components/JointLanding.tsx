import React, { useState, useEffect } from "react";
import { Music, Play, ArrowRight, Sparkles, HelpCircle, Sun, Moon } from "lucide-react";
import { motion } from "motion/react";

interface JointLandingProps {
  onJoin: (code: string, userName: string) => void;
  onCreate: (userName: string) => void;
  errorMsg: string;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export default function JointLanding({ onJoin, onCreate, errorMsg, theme, onToggleTheme }: JointLandingProps) {
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem("groove_username") || "";
  });
  const [roomCode, setRoomCode] = useState("");

  // Retrieve room code from URL parameters automatically (e.g., ?room=12345)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam && roomParam.length === 5) {
      setRoomCode(roomParam);
    }
  }, []);

  const handleSaveUsername = (name: string) => {
    setUserName(name);
    localStorage.setItem("groove_username", name);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;
    if (roomCode.trim().length !== 5) return;
    onJoin(roomCode.trim(), userName.trim());
  };

  const handleCreateSubmit = () => {
    if (!userName.trim()) return;
    onCreate(userName.trim());
  };

  // Demo tracks that make starting a test room incredibly easy
  const seedTracks = [
    { title: "Lofi Hip Hop Study Beats", id: "jfKfPfyJRdk", artist: "Lofi Girl" },
    { title: "Retro Synthwave Drive", id: "4xDzrJKXOOY", artist: "Synth Chill" },
    { title: "Deep Space Ambient", id: "5qap5aO4i9A", artist: "Cosmic Ambient" },
  ];

  const isDark = theme === "dark";

  return (
    <div className={`min-h-screen flex flex-col justify-between p-6 relative overflow-hidden font-sans transition-colors duration-500 ${
      isDark 
        ? "bg-gradient-to-b from-[#070b13] via-[#05060a] to-[#020306] text-neutral-100" 
        : "bg-gradient-to-b from-[#e8f1fd] via-[#f4f7fe] to-[#ffffff] text-neutral-800"
    }`}>
      {/* Dynamic theme switch toggle absolute placement */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={onToggleTheme}
          className={`p-3 rounded-full border transition-all shadow-md active:scale-95 cursor-pointer ${
            isDark 
              ? "bg-[#0c1122]/80 border-[#1e2947] text-yellow-400 hover:text-yellow-300 hover:bg-[#121932]" 
              : "bg-white border-[#bfd3ec] text-indigo-600 hover:text-indigo-500 hover:bg-neutral-50 shadow-indigo-950/5"
          }`}
          title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
        >
          {isDark ? <Sun className="w-5 h-5 fill-current" /> : <Moon className="w-5 h-5 fill-current" />}
        </button>
      </div>

      {/* Background radial/linear glow for the Polar Aurora effect */}
      <div className={`absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full blur-[160px] pointer-events-none transition-all duration-500 ${
        isDark ? "bg-cyan-500/5" : "bg-cyan-500/10"
      }`} />
      <div className={`absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none transition-all duration-500 ${
        isDark ? "bg-indigo-500/5" : "bg-indigo-500/15"
      }`} />
      <div className={`absolute top-[30%] left-[40%] w-[350px] h-[350px] rounded-full blur-[120px] pointer-events-none animate-pulse transition-all duration-500 ${
        isDark ? "bg-teal-500/5" : "bg-teal-500/8"
      }`} />

      {/* Top Header */}
      <div className="max-w-md mx-auto w-full pt-8 text-center flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className={`w-16 h-16 bg-gradient-to-tr from-cyan-400 via-teal-400 to-indigo-600 rounded-2xl flex items-center justify-center glow-aurora mb-4 shadow-[0_0_20px_rgba(6,182,212,0.25)]`}
        >
          <Music className="w-8 h-8 text-[#0a0f1d]" />
        </motion.div>
        
        <h1 className={`text-4xl font-extrabold font-display tracking-tight bg-gradient-to-r ${
          isDark 
            ? "from-cyan-400 via-teal-200 to-indigo-400" 
            : "from-cyan-600 via-indigo-500 to-indigo-700"
        } bg-clip-text text-transparent`}>
          GrooveRoom
        </h1>
        <p className={`text-xs font-mono mt-2 font-bold tracking-wider uppercase ${
          isDark ? "text-cyan-400/80" : "text-cyan-600/90"
        }`}>
          ✦ Synchronized Listening Circle ✦
        </p>
      </div>

      {/* Main Action Card */}
      <div className="max-w-md mx-auto w-full my-auto py-8">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className={`backdrop-blur-xl p-5 sm:p-8 rounded-3xl transition-all duration-300 ${
            isDark 
              ? "bg-[#0c1122]/60 border border-[#1b2542] shadow-[0_20px_50px_rgba(0,0,0,0.6)]" 
              : "bg-white/90 border border-[#b2cdf4] shadow-[0_20px_50px_rgba(30,41,59,0.08)]"
          }`}
        >
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-500 px-4 py-3 rounded-xl text-xs mb-6 text-center animate-pulse font-mono">
              {errorMsg}
            </div>
          )}

          {/* User Profile Info section */}
          <div className="space-y-4">
            <div>
              <label htmlFor="userName" className={`block text-[11px] font-mono uppercase tracking-widest mb-2.5 font-bold ${
                isDark ? "text-cyan-400/80" : "text-indigo-650"
              }`}>
                Your Groove Handle
              </label>
              <input
                id="userName"
                type="text"
                maxLength={16}
                value={userName}
                onChange={(e) => handleSaveUsername(e.target.value)}
                placeholder="e.g. Shubham, AstroDJ"
                className={`w-full rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-1 transition-all font-sans ${
                  isDark
                    ? "bg-[#05070c] border border-[#1e2947] hover:border-cyan-500/50 text-neutral-100 placeholder-[#3e4f7a] focus:border-cyan-400 focus:ring-cyan-400"
                    : "bg-[#f5f8fd] border border-[#bfd3ec] hover:border-indigo-400/50 text-neutral-900 placeholder-[#7a8da3] focus:border-indigo-500 focus:ring-indigo-500"
                }`}
              />
            </div>

            {userName.trim().length > 0 ? (
              <div className="space-y-6 pt-4 animate-fade-in">
                {/* Divide Actions */}
                <div className="grid grid-cols-1 gap-4">
                  {/* Create Room Option */}
                  <button
                    onClick={handleCreateSubmit}
                    className="w-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl py-4 px-4 font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-cyan-950/10 hover:shadow-cyan-500/20 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Create a New Groove Circle
                    <Sparkles className="w-4 h-4 text-cyan-200" />
                  </button>

                  <div className="flex items-center gap-3 py-1">
                    <div className={`h-px flex-1 ${isDark ? "bg-[#1e2947]" : "bg-[#bfd3ec]"}`} />
                    <span className={`text-[10px] font-mono uppercase tracking-widest font-bold ${isDark ? "text-[#4e5f8a]" : "text-[#5e77ad]"}`}>or join active</span>
                    <div className={`h-px flex-1 ${isDark ? "bg-[#1e2947]" : "bg-[#bfd3ec]"}`} />
                  </div>

                  {/* Join Room Form */}
                  <form onSubmit={handleJoinSubmit} className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={5}
                        pattern="[0-9]{5}"
                        required
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="Enter 5-digit room code"
                        className={`flex-1 min-w-0 rounded-xl px-4 py-3.5 text-center text-lg font-mono tracking-widest uppercase focus:outline-none focus:ring-1 transition-all ${
                          isDark
                            ? "bg-[#05070c] border border-[#1e2947] text-[#22d3ee] placeholder-[#2e3e60] focus:border-cyan-400 focus:ring-cyan-400"
                            : "bg-[#f5f8fd] border border-[#bfd3ec] text-[#0891b2] placeholder-[#819ab0] focus:border-indigo-500 focus:ring-indigo-550"
                        }`}
                      />
                      <button
                        type="submit"
                        disabled={roomCode.length !== 5}
                        className={`shrink-0 rounded-xl px-5 flex items-center justify-center transition-colors font-bold cursor-pointer transition-all ${
                          isDark
                            ? "bg-cyan-500 hover:bg-cyan-400 disabled:bg-[#151c30] disabled:text-[#3d4b6e] text-[#0a101f]"
                            : "bg-indigo-600 hover:bg-indigo-500 disabled:bg-[#eaf1f8] disabled:text-[#9bb3cc] text-white"
                        }`}
                      >
                        <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <p className={`text-[11px] font-mono text-center pt-4 font-bold ${
                isDark ? "text-[#4e5f8a]" : "text-indigo-500/80"
              }`}>
                👋 Please define your handle to initialize session keys.
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Seed helper section at bottom */}
      <div className="max-w-md mx-auto w-full pb-8">
        <div className={`border rounded-2xl p-4 backdrop-blur-sm shadow-inner transition-colors duration-300 ${
          isDark 
            ? "border-[#141d33] bg-[#0a0e1c]/40" 
            : "border-[#bfd3ec] bg-[#f0f5fc]/60"
        }`}>
          <p className={`text-[10px] font-mono uppercase tracking-widest mb-2.5 flex items-center gap-1.5 font-bold ${
            isDark ? "text-cyan-400/80" : "text-cyan-600"
          }`}>
            <HelpCircle className="w-3.5 h-3.5" /> Curated Test Songs (IDS)
          </p>
          <div className="grid grid-cols-1 gap-2">
            {seedTracks.map((tr) => (
              <div
                key={tr.id}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors duration-300 ${
                  isDark 
                    ? "bg-[#04060c] border-[#141e35]" 
                    : "bg-white border-[#bfd3ec]"
                }`}
              >
                <div className="text-left">
                  <p className={`text-xs font-semibold truncate max-w-[200px] ${isDark ? "text-neutral-200" : "text-neutral-700"}`}>{tr.title}</p>
                  <p className={`text-[10px] font-mono tracking-tight ${isDark ? "text-cyan-500/70" : "text-indigo-600/80"}`}>{tr.artist}</p>
                </div>
                <div className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg border transition-colors duration-300 ${
                  isDark 
                    ? "bg-[#090e1c] border-[#1d2949]" 
                    : "bg-[#f0f4fa] border-[#c0d4ec]"
                }`}>
                  <span className={`text-[10px] font-mono tracking-wider font-bold select-all ${
                    isDark ? "text-cyan-400" : "text-indigo-600"
                  }`}>
                    {tr.id}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className={`text-[9px] text-center mt-3 leading-relaxed font-bold ${
            isDark ? "text-[#4e5f8a]" : "text-[#5e77ad]"
          }`}>
            Pasting these IDs or any YouTube video URLs into the queue search tab will let you add content instantly!
          </p>
        </div>
      </div>
    </div>
  );
}

