import React, { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Users, Crown, Heart, Flame, Laugh, Smile, Sparkles } from "lucide-react";
import { Room, ChatMessage } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface ChatPanelProps {
  room: Room;
  userId: string;
  onSendWS: (msg: any) => void;
}

export default function ChatPanel({ room, userId, onSendWS }: ChatPanelProps) {
  const { chat, participants, code, hostId } = room;

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState("");

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
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col overflow-hidden h-[540px] relative font-sans">
      
      {/* Participant List & Info Ribbon */}
      <div className="bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-800 p-4 relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300">
            Listeners Circle
          </span>
          <span className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] rounded-full text-emerald-400 font-bold font-mono">
            {participants.length}/10 Active
          </span>
        </div>

        {/* Floating Code panel */}
        <div className="flex items-center gap-1.5 bg-neutral-950 p-1 px-2.5 rounded-lg border border-neutral-800 select-all">
          <span className="text-[10px] font-mono text-neutral-500 uppercase">Room:</span>
          <span className="text-xs font-mono font-bold text-emerald-400 tracking-wider">
            {code}
          </span>
        </div>
      </div>

      {/* Bubble Participants Roll */}
      <div className="flex gap-2 p-3 bg-neutral-950/40 border-b border-neutral-800/40 overflow-x-auto select-none">
        {participants.map((user) => {
          const isUserHost = user.userId === hostId;
          const isCurrentUser = user.userId === userId;

          return (
            <div
              key={user.userId}
              title={user.userName + (isUserHost ? " (Host)" : "")}
              className={`flex items-center gap-1.5 px-3 py-1 bg-neutral-900 border rounded-full shrink-0 relative ${
                isUserHost 
                  ? "border-purple-500/40 text-purple-200" 
                  : "border-neutral-800/60 text-neutral-400"
              }`}
            >
              <div className="relative">
                {/* Visual initials Avatar bubble */}
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-extrabold ${
                  isUserHost ? "bg-purple-600 text-white" : "bg-neutral-800 text-neutral-300"
                }`}>
                  {user.userName ? user.userName.substring(0, 2).toUpperCase() : "?"}
                </div>
                {/* Active flash */}
                <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full border border-neutral-900" />
              </div>

              <span className="text-[10px] font-medium max-w-[80px] truncate">
                {user.userName}
              </span>

              {isUserHost && <Crown className="w-3 h-3 text-purple-400 fill-purple-400 shrink-0" />}
              {isCurrentUser && <span className="text-[8px] text-neutral-600 uppercase tracking-widest font-mono shrink-0">(You)</span>}
            </div>
          );
        })}
      </div>

      {/* Scrolling Chat log */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-neutral-950/20"
      >
        {chat.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-2.5 h-full opacity-60">
            <MessageSquare className="w-5 h-5 text-neutral-650" />
            <div>
              <h5 className="text-xs font-semibold text-neutral-400">Silent Circle Chat</h5>
              <p className="text-[10px] text-neutral-600 mt-0.5 max-w-[180px] mx-auto leading-relaxed">
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
                  <span className="font-mono text-[9px] text-purple-400/80 bg-purple-500/5 px-3 py-1 rounded-full border border-purple-500/10 leading-relaxed max-w-sm">
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
                <div className="flex items-center gap-1.5 mb-1 text-[10px] font-mono text-neutral-500 select-none">
                  <span className={isCurrentUser ? "text-purple-400 font-semibold" : "text-neutral-400"}>
                    {msg.userName}
                  </span>
                  <span>•</span>
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`p-3 rounded-2xl max-w-[85%] text-xs hyphens-auto break-words inline-block ${
                  isCurrentUser
                    ? "bg-purple-600 text-white rounded-tr-none shadow-md shadow-purple-500/5"
                    : "bg-neutral-800 text-neutral-200 rounded-tl-none border border-neutral-700/40"
                }`}>
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating React Emmiters Panel */}
      <div className="bg-neutral-950 p-2 border-t border-neutral-800/60 flex items-center justify-around select-none">
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
      <form onSubmit={handleSendChat} className="bg-neutral-900 border-t border-neutral-800 p-3 flex gap-2">
        <input
          type="text"
          maxLength={120}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Discuss tracks, suggest vibe shifts..."
          className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-850 disabled:text-neutral-600 text-white p-2.5 rounded-xl flex items-center justify-center transition-colors shrink-0 cursor-pointer"
        >
          <Send className="w-4 h-4 fill-current text-white outline-none" />
        </button>
      </form>
    </div>
  );
}
