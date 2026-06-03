/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Room, Track, ChatMessage } from "./types";
import JointLanding from "./components/JointLanding";
import MiniPlayer from "./components/MiniPlayer";
import SongQueue from "./components/SongQueue";
import SearchPanel from "./components/SearchPanel";
import ChatPanel from "./components/ChatPanel";
import { Music, Share2, LogOut, Copy, Check, Info, Library, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { playNotificationSound, playChatPingSound } from "./lib/sounds";

export default function App() {
  const [userName, setUserName] = useState("");
  const [userId] = useState(() => {
    let id = localStorage.getItem("groove_userid");
    if (!id) {
      id = "usr_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("groove_userid", id);
    }
    return id;
  });

  const [room, setRoom] = useState<Room | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connecting" | "connected" | "disconnected">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("groove_theme") as "dark" | "light") || "dark";
  });

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("groove_theme", newTheme);
  };

  // Floating reactions list
  interface FloatingReact {
    id: string;
    emoji: string;
    userName: string;
    left: number;
  }
  const [floatingReacts, setFloatingReacts] = useState<FloatingReact[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const prevQueueIdsRef = useRef<string[]>([]);
  const isFirstSyncRef = useRef(true);

  // Parse direct shared links on mount if already joining
  const [isPreJoinCode, setIsPreJoinCode] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    
    const storedRoomCode = localStorage.getItem("groove_roomcode");
    const storedUserName = localStorage.getItem("groove_username");

    if (roomParam && roomParam.length === 5) {
      setIsPreJoinCode(roomParam);
      if (storedRoomCode === roomParam && storedUserName) {
        connectToRoom(roomParam, storedUserName);
      }
    } else if (storedRoomCode && storedRoomCode.length === 5 && storedUserName) {
      connectToRoom(storedRoomCode, storedUserName);
    }
  }, []);

  const connectToRoom = (code: string, uName: string) => {
    isFirstSyncRef.current = true;
    setConnectionStatus("connecting");
    setErrorMsg("");

    // Build the correct WebSocket protocol path depending on the active environment
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      // Send handshakes
      ws.send(JSON.stringify({
        type: "join",
        code,
        userName: uName,
        userId
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type } = data;

        if (type === "sync") {
          const newRoom = data.room;
          const isUserHost = newRoom.hostId === userId;

          if (!isFirstSyncRef.current && isUserHost) {
            const hasNewUserAddedTrack = newRoom.queue.some((t: any) => 
              !prevQueueIdsRef.current.includes(t.id) && 
              t.addedBy !== "system_autoplay" &&
              t.addedBy !== userId
            );
            if (hasNewUserAddedTrack) {
              playNotificationSound();
            }
          }

          isFirstSyncRef.current = false;
          prevQueueIdsRef.current = newRoom.queue.map((t: any) => t.id);

          setRoom(newRoom);
          setConnectionStatus("connected");
          setUserName(uName);

          localStorage.setItem("groove_roomcode", newRoom.code);
          localStorage.setItem("groove_username", uName);

          // Update URL bar silently to support direct room code copying without hard reloading
          const newUrl = `${window.location.origin}?room=${data.room.code}`;
          window.history.pushState({}, "", newUrl);
        } else if (type === "room_ended") {
          setToast({ message: data.message || "The host has closed the room. Returning to main menu.", type: "warning" });
          localStorage.removeItem("groove_roomcode");
          setRoom(null);
          setConnectionStatus("idle");
          ws.close();
        } else if (type === "toast") {
          setToast({ message: data.message, type: data.toastType || "info" });
        } else if (type === "error") {
          setErrorMsg(data.message);
          setConnectionStatus("idle");
          ws.close();
        } else if (type === "chat") {
          // Play ring tone alert if message is incoming from another listener
          if (data.message && data.message.userId !== userId) {
            playChatPingSound();
          }
          // If in active room, append chat message
          setRoom(prev => {
            if (!prev) return null;
            // Prevent duplication
            if (prev.chat.some(m => m.id === data.message.id)) return prev;
            return {
              ...prev,
              chat: [...prev.chat, data.message]
            };
          });
        } else if (type === "reaction") {
          // Trigger floating particles animation
          const newReact: FloatingReact = {
            id: data.id,
            emoji: data.emoji,
            userName: data.userName,
            left: 20 + Math.random() * 60, // random offset across the container width
          };

          setFloatingReacts(prev => [...prev, newReact]);

          // Clear particles out after 2.5 seconds to prevent memory overflow leaks
          setTimeout(() => {
            setFloatingReacts(prev => prev.filter(r => r.id !== data.id));
          }, 2500);
        }
      } catch (err) {
        console.error("Failed to parse websocket frame data: ", err);
      }
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
      setRoom(null);
    };

    ws.onerror = (e) => {
      console.error("WS general link error:", e);
      const isServerless = window.location.hostname.includes("vercel") || window.location.hostname.includes("netlify") || window.location.hostname.includes("github.io");
      if (isServerless) {
        setErrorMsg("WebSockets are not natively supported by Vercel/Netlify's serverless runtime. Please host GrooveRoom on a persistent container platform like Render.com, Railway.app, or Google Cloud Run.");
      } else {
        setErrorMsg("Failed to establish WebSocket connection. Ensure your Node.js dynamic server (server.ts) is running on port 3000, or deploy to a standard container-based host.");
      }
      setConnectionStatus("idle");
    };
  };

  const handleJoinRoom = (code: string, uName: string) => {
    connectToRoom(code, uName);
  };

  const handleCreateRoom = (uName: string) => {
    // Empty code triggers room creation sequence on the server
    connectToRoom("", uName);
  };

  const handleExitRoom = () => {
    localStorage.removeItem("groove_roomcode");
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "leave_room" }));
      // Give a tiny moment for delivery before active closing
      setTimeout(() => {
        if (socketRef.current) socketRef.current.close();
      }, 100);
    } else {
      if (socketRef.current) socketRef.current.close();
    }
    // Clean URL parameters
    window.history.pushState({}, "", window.location.origin);
    setRoom(null);
    setConnectionStatus("idle");
  };

  const handleSendWSMessage = (payload: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  };

  const handleAddTrack = (track: { title: string; artist: string; youtubeId: string; duration: number; thumbnail: string }) => {
    handleSendWSMessage({
      type: "add_track",
      track
    });
  };

  const copyInviteLink = () => {
    if (!room) return;
    const shareableUrl = `${window.location.origin}?room=${room.code}`;
    navigator.clipboard.writeText(shareableUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    });
  };

  const isCurrentUserHost = room ? room.hostId === userId : false;

  return (
    <div className={`min-h-screen flex flex-col font-sans select-none overflow-x-hidden transition-colors duration-500 ${
      theme === "light"
        ? "bg-gradient-to-b from-[#f0f5fc] via-[#f8fafd] to-white text-neutral-850"
        : "bg-gradient-to-b from-[#070b13] via-[#05060a] to-[#020306] text-neutral-100"
    }`}>
      
      {/* 1. Landing View */}
      {connectionStatus !== "connected" && !room ? (
        <JointLanding
          onJoin={handleJoinRoom}
          onCreate={handleCreateRoom}
          errorMsg={errorMsg}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      ) : (
        room && (
          <div className="min-h-screen flex flex-col lg:h-screen lg:overflow-hidden relative pb-10 lg:pb-0">
            {/* Background glowing orbs */}
            <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />

            {/* Custom Emoji Visual Floating Particles Overlaid */}
            <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
              <AnimatePresence>
                {floatingReacts.map((react) => (
                  <div
                    key={react.id}
                    style={{
                      left: `${react.left}%`,
                      bottom: "10%",
                      "--float-x": `${(Math.random() - 0.5) * 80}px`,
                    } as React.CSSProperties}
                    className="absolute text-3xl floating-emoji flex flex-col items-center select-none"
                  >
                    <span>{react.emoji}</span>
                    <span className="text-[9px] font-mono font-medium text-cyan-200 bg-[#070a14] border border-[#1c2642] rounded-md px-1.5 py-0.5 mt-0.5 leading-none whitespace-nowrap shadow">
                      {react.userName}
                    </span>
                  </div>
                ))}
              </AnimatePresence>
            </div>

            {/* Top Workspace Ribbon */}
            <header className={`backdrop-blur-md p-4 shrink-0 flex items-center justify-between sticky top-0 z-20 border-b transition-colors duration-300 ${
              theme === "light"
                ? "bg-white/90 border-[#cad9ef] shadow-sm"
                : "bg-[#0c1122]/55 border-[#1b2542]"
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-tr from-cyan-400 via-teal-400 to-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.25)]">
                  <Music className="w-5 h-5 text-[#0a101f]" />
                </div>
                <div>
                  <h1 className={`text-sm font-bold tracking-wide font-display ${theme === "light" ? "text-slate-800" : "text-neutral-100"}`}>
                    GrooveRoom Workspace
                  </h1>
                  <p className={`text-[9px] font-mono mt-0.5 font-semibold uppercase tracking-widest ${theme === "light" ? "text-slate-500" : "text-[#4e5f8a]"}`}>
                    Synchronized Listening Circle
                  </p>
                </div>
              </div>

              {/* Utility buttons */}
              <div className="flex items-center gap-3">
                {/* Sun/Moon Toggle button inside the live Workspace */}
                <button
                  onClick={toggleTheme}
                  title="Toggle Light / Dark mode"
                  className={`p-2.5 rounded-xl border flex items-center justify-center cursor-pointer transition-all ${
                    theme === "light"
                      ? "bg-slate-100 hover:bg-slate-200 border-[#bfd3ec] text-slate-800"
                      : "bg-[#0c1122] border-[#1d2744] text-neutral-300 hover:bg-[#151d38] hover:text-white"
                  }`}
                >
                  {theme === "light" ? <Moon className="w-4 h-4 text-[#0c1122]" /> : <Sun className="w-4 h-4 text-[#ffd700]" />}
                </button>

                {/* Copy Link wrapper Button */}
                <button
                  onClick={copyInviteLink}
                  className={`py-2 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border cursor-pointer transition-all ${
                    copiedLink
                      ? (theme === "light"
                        ? "bg-cyan-50 border-cyan-400 text-cyan-700 font-bold"
                        : "bg-cyan-500/10 border-cyan-500/40 text-cyan-400 font-bold")
                      : (theme === "light"
                        ? "bg-white border-[#cad9ef] text-slate-700 hover:bg-slate-50 hover:border-slate-350"
                        : "bg-[#0c1122] border-[#1d2744] text-neutral-300 hover:text-white hover:border-[#2a3861] hover:bg-[#111831]")
                  }`}
                >
                  {copiedLink ? <Check className={`w-3.5 h-3.5 ${theme === "light" ? "text-cyan-700" : "text-cyan-400"}`} /> : <Copy className={`w-3.5 h-3.5 ${theme === "light" ? "text-cyan-600" : "text-cyan-400"}`} />}
                  <span>{copiedLink ? "Link Copied!" : "Copy Shared Invitation Link"}</span>
                </button>

                {/* Quit Room */}
                <button
                  onClick={handleExitRoom}
                  className={`p-2 border rounded-xl transition-all cursor-pointer ${
                    theme === "light"
                      ? "bg-white border-[#cad9ef] text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                      : "bg-[#0c1122] hover:bg-rose-500/10 border border-[#1d2744] hover:border-rose-500/30 text-neutral-400 hover:text-rose-400"
                  }`}
                  title="Leave Room"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Main grid dashboard section layout */}
            <div className="flex-1 flex flex-col lg:flex-row min-h-0 w-full max-w-[1500px] mx-auto p-4 lg:p-6 gap-6 overflow-y-auto lg:overflow-hidden">
              
              {/* Left Segment: Player controls, suggestions & search */}
              <main className="flex-1 flex flex-col min-h-0 gap-6 lg:overflow-y-auto pr-0 lg:pr-1">
                {/* Embedded synchronized music player */}
                <MiniPlayer
                  room={room}
                  userId={userId}
                  isHost={isCurrentUserHost}
                  onSendWS={handleSendWSMessage}
                  theme={theme}
                />

                {/* Fast Track Suggestions and manual ID adder */}
                <SearchPanel onAddTrack={handleAddTrack} theme={theme} />
              </main>

              {/* Central Segment: Sorted Queue with list history priorities */}
              <section className="w-full lg:w-[380px] shrink-0 flex flex-col gap-6">
                <SongQueue
                  room={room}
                  userId={userId}
                  isHost={isCurrentUserHost}
                  onSendWS={handleSendWSMessage}
                  theme={theme}
                />
              </section>

              {/* Right Segment: Scrollable chat circle with live reaction buttons */}
              <aside className="w-full lg:w-[320px] shrink-0 flex flex-col">
                <ChatPanel
                  room={room}
                  userId={userId}
                  onSendWS={handleSendWSMessage}
                  theme={theme}
                />
              </aside>

            </div>
          </div>
        )
      )}

      {/* Floating Toast notification toast system */}
      <div className="fixed bottom-6 right-6 z-[100] pointer-events-none">
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, y: 15, transition: { duration: 0.2 } }}
              className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 border rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.15)] max-w-sm ${
                theme === "light"
                  ? "bg-white border-cyan-400 text-slate-800"
                  : "bg-[#0c1122] border-cyan-500/30 text-neutral-200"
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
              <p className={`text-xs font-semibold tracking-wide font-sans leading-relaxed ${
                theme === "light" ? "text-slate-850" : "text-neutral-200"
              }`}>
                {toast.message}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
