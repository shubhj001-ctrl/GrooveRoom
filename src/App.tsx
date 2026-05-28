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
import { Music, Share2, LogOut, Copy, Check, Info, Library } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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

  // Floating reactions list
  interface FloatingReact {
    id: string;
    emoji: string;
    userName: string;
    left: number;
  }
  const [floatingReacts, setFloatingReacts] = useState<FloatingReact[]>([]);

  const socketRef = useRef<WebSocket | null>(null);

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
    if (roomParam && roomParam.length === 5) {
      setIsPreJoinCode(roomParam);
    }
  }, []);

  const connectToRoom = (code: string, uName: string) => {
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
          setRoom(data.room);
          setConnectionStatus("connected");
          setUserName(uName);

          // Update URL bar silently to support direct room code copying without hard reloading
          const newUrl = `${window.location.origin}?room=${data.room.code}`;
          window.history.pushState({}, "", newUrl);
        } else if (type === "toast") {
          setToast({ message: data.message, type: data.toastType || "info" });
        } else if (type === "error") {
          setErrorMsg(data.message);
          setConnectionStatus("idle");
          ws.close();
        } else if (type === "chat") {
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
    if (socketRef.current) {
      socketRef.current.close();
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans select-none overflow-x-hidden">
      
      {/* 1. Landing View */}
      {connectionStatus !== "connected" && !room ? (
        <JointLanding
          onJoin={handleJoinRoom}
          onCreate={handleCreateRoom}
          errorMsg={errorMsg}
        />
      ) : (
        room && (
          <div className="min-h-screen flex flex-col lg:h-screen lg:overflow-hidden relative pb-10 lg:pb-0">
            {/* Background glowing orbs */}
            <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-purple-900/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-emerald-900/5 rounded-full blur-[120px] pointer-events-none" />

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
                    <span className="text-[9px] font-mono font-medium text-neutral-400 bg-neutral-950/95 border border-neutral-800 rounded-md px-1 py-0.5 mt-0.5 leading-none whitespace-nowrap shadow">
                      {react.userName}
                    </span>
                  </div>
                ))}
              </AnimatePresence>
            </div>

            {/* Top Workspace Ribbon */}
            <header className="bg-neutral-900/45 border-b border-neutral-800/80 backdrop-blur-md p-4 shrink-0 flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center glow-purple">
                  <Music className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold tracking-wide font-display text-neutral-200">
                    GrooveRoom Workspace
                  </h1>
                  <p className="text-[10px] text-neutral-500 font-mono mt-0.5 font-light uppercase tracking-widest">
                    Synchronized Listening Circle
                  </p>
                </div>
              </div>

              {/* Utility buttons */}
              <div className="flex items-center gap-3">
                {/* Copy Link wrapper Button */}
                <button
                  onClick={copyInviteLink}
                  className={`py-2 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border cursor-pointer transition-all ${
                    copiedLink
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700/80 hover:bg-neutral-850"
                  }`}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-neutral-400" />}
                  <span>{copiedLink ? "Link Copied" : "Copy Shared Invitation Link"}</span>
                </button>

                {/* Quit Room */}
                <button
                  onClick={handleExitRoom}
                  className="p-2 bg-neutral-900 hover:bg-rose-500/10 border border-neutral-800 text-neutral-400 hover:text-rose-400 rounded-xl transition-all cursor-pointer"
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
                />

                {/* Fast Track Suggestions and manual ID adder */}
                <SearchPanel onAddTrack={handleAddTrack} />
              </main>

              {/* Central Segment: Sorted Queue with list history priorities */}
              <section className="w-full lg:w-[380px] shrink-0 flex flex-col gap-6">
                <SongQueue
                  room={room}
                  userId={userId}
                  isHost={isCurrentUserHost}
                  onSendWS={handleSendWSMessage}
                />
              </section>

              {/* Right Segment: Scrollable chat circle with live reaction buttons */}
              <aside className="w-full lg:w-[320px] shrink-0 flex flex-col">
                <ChatPanel
                  room={room}
                  userId={userId}
                  onSendWS={handleSendWSMessage}
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
              className="pointer-events-auto flex items-center gap-3 px-5 py-3.5 bg-neutral-900 border border-purple-500/30 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] max-w-sm"
            >
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse shrink-0" />
              <p className="text-xs font-semibold text-neutral-200 tracking-wide font-sans leading-relaxed">
                {toast.message}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
