import React, { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Users, Crown, Heart, Flame, Laugh, Smile, Sparkles, Music } from "lucide-react";
import { Room, ChatMessage } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface ChatPanelProps {
  room: Room;
  userId: string;
  onSendWS: (msg: any) => void;
  theme?: "dark" | "light";
}

export default function ChatPanel({ room, userId, onSendWS, theme }: ChatPanelProps) {
  const { chat, participants, code, hostId } = room;

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState("");

  const isDark = theme !== "light";

  // Auto-scroll chat to the bottom as new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chat]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    onSendWS({
      type: "chat",
      text: inputText.trim()
    });

    setInputText("");
  };

  // Immediate float react broadcast trigger
  const handleReact = (emoji: string) => {
    onSendWS({
      type: "react",
      emoji
    });
  };

  const quickReactEmojis = ["🔥", "❤️", "😂", "👏", "😮", "😭"];

  return (
    <div className={`border rounded-3xl flex flex-col overflow-hidden h-[540px] relative font-sans shadow-xl transition-all duration-300 ${
      isDark 
        ? "bg-[#0c1122]/75 border-[#1b2542] text-[#f8fafc]" 
        : "bg-white border-[#cad9ef] text-neutral-800 shadow-xl shadow-[0_15px_35px_rgba(30,41,59,0.05)]"
    }`}>
      
      {/* Participant List & Info Ribbon */}
      <div className={`backdrop-blur-xl border-b p-4 relative z-10 flex items-center justify-between transition-colors duration-350 ${
        isDark 
          ? "bg-[#0d1326]/90 border-[#1b2542]" 
          : "bg-[#f0f4fa] border-[#bfd3ec]"
      }`}>
        <div className="flex items-center gap-2">
          <Users className={`w-4 h-4 ${isDark ? "text-cyan-400" : "text-cyan-600"}`} />
          <span className={`text-xs font-mono font-bold uppercase tracking-widest ${isDark ? "text-[#8ea0d2]" : "text-[#24355a]"}`}>
            Listeners Circle
          </span>
          <span className={`border px-2 py-0.5 text-[10px] rounded-full font-bold font-mono transition-colors duration-300 ${
            isDark 
              ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" 
              : "bg-[#fff1f2] border-rose-200 text-rose-600"
          }`}>
            {participants.length}/10 Active
          </span>
        </div>

        {/* Floating Code panel */}
        <div className={`flex items-center gap-1.5 p-1 px-3 rounded-xl border select-all transition-colors duration-300 ${
          isDark 
            ? "bg-[#05070c] border-[#1c2745]" 
            : "bg-white border-[#bfd3ec] shadow-sm animate-pulse-slow"
        }`}>
          <span className={`text-[9px] font-mono font-bold uppercase tracking-wider ${isDark ? "text-[#4e5f8a]" : "text-[#5e77ad]"}`}>Room:</span>
          <span className={`text-xs font-mono font-bold tracking-widest ${isDark ? "text-cyan-400" : "text-cyan-650"}`}>
            {code}
          </span>
        </div>
      </div>

      {/* Bubble Participants Roll */}
      <div className={`flex gap-2 p-3 overflow-x-auto select-none border-b transition-colors duration-300 ${
        isDark ? "bg-[#05070c]/50 border-[#141b31]" : "bg-[#f5f8fd]/75 border-[#bfd3ec]"
      }`}>
        {participants.map((user) => {
          const isUserHost = user.userId === hostId;
          const isCurrentUser = user.userId === userId;
          const isUserDJ = room.djIds?.includes(user.userId) || isUserHost;
          const showDjButton = hostId === userId && !isUserHost; // only actual Host can toggle others

          return (
            <div
              key={user.userId}
              title={user.userName + (isUserHost ? " (Host)" : isUserDJ ? " (DJ)" : "")}
              className={`flex items-center gap-1.5 px-3 py-1 border rounded-full shrink-0 relative transition-all ${
                isUserHost 
                  ? (isDark ? "border-cyan-500/40 text-cyan-200 bg-[#080c16]/50" : "border-cyan-350 text-cyan-850 bg-cyan-50")
                  : isUserDJ
                  ? (isDark ? "border-emerald-500/40 text-emerald-200 bg-[#080c16]/50" : "border-emerald-350 text-emerald-850 bg-emerald-50")
                  : (isDark ? "border-[#141b31] text-[#8ea0d2] bg-[#080c16]/50" : "border-[#bfd3ec] text-[#24355a] bg-white shadow-sm")
              }`}
            >
              <div className="relative">
                {/* Visual initials Avatar bubble */}
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-extrabold ${
                  isUserHost 
                    ? "bg-cyan-500 text-[#0a1122]" 
                    : isUserDJ 
                    ? "bg-emerald-600 text-white" 
                    : (isDark ? "bg-[#141d33] text-[#8ea0d2]" : "bg-[#e2e8f0] text-[#24355a]")
                }`}>
                  {user.userName ? user.userName.substring(0, 2).toUpperCase() : "?"}
                </div>
                {/* Active flash */}
                <span className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-[#00f5ff] rounded-full border ${isDark ? "border-[#05070c]" : "border-white"}`} />
              </div>

              <span className="text-[10px] font-semibold max-w-[80px] truncate leading-none">
                {user.userName}
              </span>

              {isUserHost && <Crown className={`w-3 h-3 shrink-0 ${isDark ? "text-cyan-400 fill-cyan-400" : "text-cyan-600 fill-cyan-200"}`} />}
              {!isUserHost && isUserDJ && <Music className="w-3 h-3 text-emerald-500 shrink-0 animate-pulse" />}
              {isCurrentUser && <span className={`text-[8px] uppercase tracking-widest font-mono shrink-0 ${isDark ? "text-[#4e5f8a]" : "text-[#5e77ad]"}`}>(You)</span>}

              {/* DJ privilege toggle button for Host */}
              {showDjButton && (
                <button
                  onClick={() => onSendWS({ type: "toggle_dj", targetUserId: user.userId })}
                  className={`ml-1.5 p-0.5 rounded cursor-pointer transition-colors ${
                    isUserDJ 
                      ? (isDark ? "bg-emerald-500/15 hover:bg-emerald-500/35 text-emerald-400" : "bg-emerald-100 hover:bg-emerald-200 text-emerald-800") 
                      : (isDark ? "bg-[#121931] hover:bg-[#1a2346] text-[#4e5f8a] hover:text-cyan-400" : "bg-[#f1f5f9] hover:bg-slate-200 text-[#5e77ad] hover:text-cyan-600")
                  }`}
                  title={isUserDJ ? "Revoke DJ permissions" : "Grant DJ permissions"}
                >
                  <Music className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Scrolling Chat log */}
      <div
        ref={chatContainerRef}
        className={`flex-1 overflow-y-auto p-4 space-y-3.5 transition-colors duration-300 ${
          isDark ? "bg-[#05070c]/20" : "bg-[#f5f8fd]/45"
        }`}
      >
        {chat.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-2.5 h-full opacity-60">
            <MessageSquare className={`w-5 h-5 ${isDark ? "text-cyan-500/30" : "text-cyan-600/30"}`} />
            <div>
              <h5 className={`text-xs font-bold ${isDark ? "text-neutral-400" : "text-neutral-700"}`}>Silent Circle Chat</h5>
              <p className={`text-[10px] mt-1 max-w-[180px] mx-auto leading-relaxed font-semibold ${isDark ? "text-[#526490]" : "text-[#5e77ad]"}`}>
                Send a message or click an emoji to notify participants.
              </p>
            </div>
          </div>
        ) : (
          chat.map((msg) => {
            const isSystem = msg.type === "system";
            const isCurrentUser = msg.userId === userId;

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center text-center py-0.5 select-none">
                  <span className={`font-mono text-[9px] px-3 py-1 rounded-full border leading-relaxed max-w-sm font-bold ${
                    isDark 
                      ? "text-cyan-400 bg-cyan-950/30 border-cyan-500/10" 
                      : "text-cyan-700 bg-cyan-50 border-cyan-200"
                  }`}>
                    ✦ {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isCurrentUser ? "items-end text-right" : "items-start text-left"}`}
              >
                <div className={`flex items-center gap-1.5 mb-1 text-[10px] font-mono select-none ${isDark ? "text-[#526490]" : "text-[#5e77ad]"}`}>
                  <span className={isCurrentUser ? (isDark ? "text-cyan-400 font-bold" : "text-cyan-650 font-extrabold") : (isDark ? "text-neutral-400 font-medium" : "text-neutral-700 font-bold")}>
                    {msg.userName}
                  </span>
                  <span>•</span>
                  <span className="font-semibold">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`p-3 rounded-2xl max-w-[85%] text-xs hyphens-auto break-words inline-block font-sans ${
                  isCurrentUser
                    ? "bg-gradient-to-tr from-cyan-500 to-indigo-500 text-white rounded-tr-none shadow-md shadow-cyan-950/10"
                    : (isDark 
                      ? "bg-[#131c32] text-neutral-200 rounded-tl-none border border-[#1d2745]" 
                      : "bg-white text-neutral-800 rounded-tl-none border border-[#bfd3ec] shadow-sm")
                }`}>
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating React Emmiters Panel */}
      <div className={`p-2 border-t flex items-center justify-around select-none transition-colors duration-300 ${
        isDark ? "bg-[#05070c] border-[#141b31]" : "bg-[#f0f4fa] border-[#bfd3ec]"
      }`}>
        {quickReactEmojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleReact(emoji)}
            className="text-lg hover:scale-125 hover:rotate-3 active:scale-95 transition-transform duration-200 p-1 cursor-pointer"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input panel form controls */}
      <form onSubmit={handleSendChat} className={`border-t p-3 flex gap-2 transition-colors duration-300 ${
        isDark ? "bg-[#0c1122] border-[#141b31]" : "bg-[#f5f8fd] border-[#bfd3ec]"
      }`}>
        <input
          type="text"
          maxLength={120}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Discuss tracks, suggest vibe shifts..."
          className={`flex-1 min-w-0 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 transition-all ${
            isDark 
              ? "bg-[#05070c] border border-[#1e2947] text-neutral-200 placeholder-[#3e4f7a] focus:border-cyan-400 focus:ring-cyan-400" 
              : "bg-white border border-[#bfd3ec] text-neutral-900 placeholder-[#7a8da3] focus:border-indigo-500 focus:ring-indigo-550"
          }`}
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className={`p-2.5 rounded-xl flex items-center justify-center transition-all shrink-0 cursor-pointer font-bold ${
            isDark
              ? "bg-cyan-500 hover:bg-cyan-400 disabled:bg-[#121931] disabled:text-[#4e5f8a] text-[#0a101f]"
              : "bg-indigo-600 hover:bg-indigo-500 disabled:bg-[#f0f4fa] disabled:text-[#a0b2c6] text-white"
          }`}
        >
          <Send className="w-4 h-4 fill-current outline-none" />
        </button>
      </form>
    </div>
  );
}
