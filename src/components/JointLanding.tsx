import React, { useState, useEffect } from "react";
import { Music, Play, ArrowRight, Sparkles, HelpCircle } from "lucide-react";
import { motion } from "motion/react";

interface JointLandingProps {
  onJoin: (code: string, userName: string) => void;
  onCreate: (userName: string) => void;
  errorMsg: string;
}

export default function JointLanding({ onJoin, onCreate, errorMsg }: JointLandingProps) {
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

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between p-6 relative overflow-hidden font-sans">
      {/* Background radial glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-900/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-950/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <div className="max-w-md mx-auto w-full pt-8 text-center flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="w-16 h-16 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center glow-purple mb-4"
        >
          <Music className="w-8 h-8 text-white" />
        </motion.div>
        <h1 className="text-4xl font-bold font-display tracking-tight bg-gradient-to-r from-purple-400 via-indigo-200 to-emerald-400 bg-clip-text text-transparent">
          GrooveRoom
        </h1>
        <p className="text-sm text-neutral-400 mt-2 font-light">
          Synchronized real-time music circles with your friends.
        </p>
      </div>

      {/* Main Action Card */}
      <div className="max-w-md mx-auto w-full my-auto py-8">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-xl p-8 rounded-3xl"
        >
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-xs mb-6 text-center animate-pulse">
              {errorMsg}
            </div>
          )}

          {/* User Profile Info section */}
          <div className="space-y-4">
            <div>
              <label htmlFor="userName" className="block text-xs font-mono text-neutral-400 uppercase tracking-widest mb-2">
                Your Groove Handle
              </label>
              <input
                id="userName"
                type="text"
                maxLength={16}
                value={userName}
                onChange={(e) => handleSaveUsername(e.target.value)}
                placeholder="e.g. Shubham, AstroDJ"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-purple-500 text-sm focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {userName.trim().length > 0 ? (
              <div className="space-y-6 pt-4 animate-fade-in">
                {/* Divide Actions */}
                <div className="grid grid-cols-1 gap-4">
                  {/* Create Room Option */}
                  <button
                    onClick={handleCreateSubmit}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl py-3.5 px-4 font-semibold text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-purple-500/10 transition-all active:scale-[0.98]"
                  >
                    Create a New Groove Circle
                    <Sparkles className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px bg-neutral-800 flex-1" />
                    <span className="text-xs font-mono text-neutral-500 uppercase tracking-widest">or join active</span>
                    <div className="h-px bg-neutral-800 flex-1" />
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
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-center text-lg font-mono tracking-widest text-emerald-400 placeholder-neutral-700 uppercase focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                      <button
                        type="submit"
                        disabled={roomCode.length !== 5}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-xl px-5 flex items-center justify-center transition-colors font-medium cursor-pointer"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <p className="text-xs font-mono text-neutral-500 text-center pt-4">
                👋 Please define your handle to initialize session keys.
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Seed helper section at bottom */}
      <div className="max-w-md mx-auto w-full pb-8">
        <div className="border border-neutral-800/40 rounded-2xl p-4 bg-neutral-900/20">
          <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-neutral-500" /> Curated Test Songs (IDS)
          </p>
          <div className="grid grid-cols-1 gap-2">
            {seedTracks.map((tr) => (
              <div
                key={tr.id}
                className="flex items-center justify-between bg-neutral-950 p-2.5 rounded-xl border border-neutral-800/40"
              >
                <div className="text-left">
                  <p className="text-xs text-neutral-300 font-medium truncate max-w-[200px]">{tr.title}</p>
                  <p className="text-[10px] text-neutral-500">{tr.artist}</p>
                </div>
                <div className="flex items-center gap-1.5 bg-neutral-900 py-1 px-2.5 rounded-lg border border-neutral-800/60">
                  <span className="text-[10px] font-mono text-purple-400 tracking-wider font-semibold select-all">
                    {tr.id}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-neutral-600 text-center mt-3 leading-relaxed">
            Pasting these IDs or any YouTube video URLs into the queue search tab will let you add content instantly!
          </p>
        </div>
      </div>
    </div>
  );
}
