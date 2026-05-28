import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import * as dotenv from "dotenv";

dotenv.config();

// Standard interfaces (imported inline or referenced)
import { Room, Track, ChatMessage, Participant, PlaybackState } from "./src/types";

const app = express();
const PORT = 3000;
const server = http.createServer(app);

app.use(express.json());

// In-memory store of active rooms
// roomCode -> Room
const rooms = new Map<string, Room>();

// WebSocket connection mapping: socket -> context info
interface ClientContext {
  ws: WebSocket;
  roomCode: string;
  userId: string;
  userName: string;
}
const clients = new Map<WebSocket, ClientContext>();

// Helper to generate a 5-digit code
function generateRoomCode(): string {
  let attempts = 0;
  while (attempts < 1000) {
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    if (!rooms.has(code)) {
      return code;
    }
    attempts++;
  }
  return "99999";
}

// Tick elapsed time for all playing rooms to manage server-authoritative queue transitions
setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, code) => {
    if (room.currentTrack && room.playback.isPlaying) {
      room.playback.currentTime += 1;
      room.playback.lastUpdated = now;

      // Check if current song has concluded
      if (room.playback.currentTime >= room.currentTrack.duration) {
        // Move current song to history
        room.history.unshift({ ...room.currentTrack });
        if (room.history.length > 50) room.history.pop();

        // Advance to next song in queue
        if (room.queue.length > 0) {
          const nextTrack = room.queue.shift()!;
          room.currentTrack = nextTrack;
          room.playback = {
            isPlaying: true,
            currentTime: 0,
            lastUpdated: now,
          };
        } else {
          room.currentTrack = null;
          room.playback = {
            isPlaying: false,
            currentTime: 0,
            lastUpdated: now,
          };
        }
        room.skipVotes = []; // Reset votes
        broadcastRoomState(code);
      }
    }
  });
}, 1000);

// Real YouTube Search scraper endpoint
app.get("/api/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== "string") {
      res.status(400).json({ error: "Query parameter is required" });
      return;
    }

    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%253D%253D`; // sp=EgIQAQ%3D%3D restricts to videos only
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      }
    });

    const html = await response.text();
    
    // Look for ytInitialData JSON inside the page HTML
    const match = html.match(/ytInitialData\s*=\s*({.+?});/);
    if (!match) {
      // Fallback regex extraction
      const videoIds = Array.from(html.matchAll(/\/watch\?v=([a-zA-Z0-9_\-]{11})/g)).map(m => m[1]);
      const uniqueIds = Array.from(new Set(videoIds)).slice(0, 5);
      const results = uniqueIds.map(id => ({
        title: `Track: ${q}`,
        artist: "YouTube Video",
        youtubeId: id,
        duration: 180,
        thumbnail: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
      }));
      res.json({ results });
      return;
    }

    const json = JSON.parse(match[1]);
    const contents = json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
    
    if (!contents || !Array.isArray(contents)) {
      res.json({ results: [] });
      return;
    }

    const results: any[] = [];
    for (const item of contents) {
      const video = item.videoRenderer;
      if (video && video.videoId) {
        const id = video.videoId;
        const title = video.title?.runs?.[0]?.text || "Unknown Track";
        const artist = video.ownerText?.runs?.[0]?.text || "Unknown Channel";
        
        const lengthText = video.lengthText?.simpleText || "3:00";
        const parts = lengthText.split(":").map(Number);
        let duration = 180;
        if (parts.length === 2) {
          duration = parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
          duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }

        results.push({
          title,
          artist,
          youtubeId: id,
          duration,
          thumbnail: `https://img.youtube.com/vi/${id}/mqdefault.jpg`
        });
        if (results.length >= 8) break;
      }
    }

    res.json({ results });
  } catch (error: any) {
    console.error("Scrape YT Search Error:", error);
    res.status(500).json({ error: error.message || "Failed to search YT" });
  }
});

// App Health
app.get("/api/health", (req, res) => {
  res.json({ roomsCount: rooms.size, status: "healthy" });
});

// Create WebSocket Server
const wss = new WebSocketServer({ noServer: true });

// Handle HTTP Upgrade manually for our port 3000 deployment
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

// Helper to broadcast room state to all clients in that room
function broadcastRoomState(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const payload = JSON.stringify({
    type: "sync",
    room,
  });

  // Collect all sockets in this room
  clients.forEach((context, socket) => {
    if (context.roomCode === roomCode && socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  });
}

// Add system message to chat & broadcast it
function sendSystemMessage(roomCode: string, text: string) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const msg: ChatMessage = {
    id: Math.random().toString(36).substr(2, 9),
    userId: "system",
    userName: "System",
    text,
    timestamp: Date.now(),
    type: "system",
  };

  room.chat.push(msg);
  // Cap chat history at 100 messages
  if (room.chat.length > 100) room.chat.shift();

  // Send specifically to make active updates snappy
  const payload = JSON.stringify({
    type: "chat",
    message: msg,
  });

  clients.forEach((context, socket) => {
    if (context.roomCode === roomCode && socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  });
}

// WebSocket implementation logic
wss.on("connection", (ws: WebSocket) => {
  ws.on("message", (rawMessage) => {
    try {
      const data = JSON.parse(rawMessage.toString());
      const { type } = data;

      if (type === "join") {
        const { code, userName, userId } = data;
        let joinedCode = code ? code.trim() : "";
        const clientUserId = userId || "user_" + Math.random().toString(36).substr(2, 5);

        let room: Room | undefined;

        if (!joinedCode) {
          // If code is empty, generate a brand new room
          joinedCode = generateRoomCode();
          room = {
            code: joinedCode,
            hostId: clientUserId,
            queue: [],
            history: [],
            participants: [],
            chat: [],
            currentTrack: null,
            playback: { isPlaying: false, currentTime: 0, lastUpdated: Date.now() },
            skipVotes: [],
          };
          rooms.set(joinedCode, room);
        } else {
          room = rooms.get(joinedCode);
          if (!room) {
            ws.send(JSON.stringify({ type: "error", message: `Room with code ${joinedCode} does not exist.` }));
            return;
          }
        }

        // Enforce the 10-person limit per session
        if (room.participants.length >= 10 && !room.participants.some(p => p.userId === clientUserId)) {
          ws.send(JSON.stringify({ 
            type: "error", 
            message: `Room is currently full. Capped at 10 participants per session for optimal listening.` 
          }));
          return;
        }

        // Register client context
        clients.set(ws, {
          ws,
          roomCode: joinedCode,
          userId: clientUserId,
          userName: userName || "Anonymous Listener",
        });

        // Add or update participant list
        const existingPartIndex = room.participants.findIndex(p => p.userId === clientUserId);
        const isHost = room.hostId === clientUserId;

        if (existingPartIndex >= 0) {
          room.participants[existingPartIndex].userName = userName;
          room.participants[existingPartIndex].isHost = isHost;
        } else {
          room.participants.push({
            userId: clientUserId,
            userNameName: userName || "Listener", // handle custom mapping if needed, or stick to simple properties
            userName: userName || "Anonymous Listener",
            joinedAt: Date.now(),
            isHost,
          } as any);
        }

        sendSystemMessage(joinedCode, `${userName || "Someone"} has joined the groove.`);
        broadcastRoomState(joinedCode);
        return;
      }

      // Check client authorization contexts
      const clientCtx = clients.get(ws);
      if (!clientCtx) {
        ws.send(JSON.stringify({ type: "error", message: "Client is not registered. Join a room first." }));
        return;
      }

      const { roomCode, userId, userName } = clientCtx;
      const room = rooms.get(roomCode);
      if (!room) {
        ws.send(JSON.stringify({ type: "error", message: "Your current room is active no longer." }));
        return;
      }

      const isHost = room.hostId === userId;

      switch (type) {
        case "add_track": {
          const { track } = data; // { title, artist, youtubeId, duration, thumbnail }
          if (!track || !track.youtubeId) {
            ws.send(JSON.stringify({ type: "error", message: "Invalid track data supplied." }));
            break;
          }

          const id = Math.random().toString(36).substr(2, 9);
          const newTrack: Track = {
            id,
            title: track.title || "Unknown Track",
            artist: track.artist || "Unknown Artist",
            youtubeId: track.youtubeId,
            duration: Number(track.duration) || 180,
            thumbnail: track.thumbnail || "",
            addedBy: userId,
            addedByName: userName,
            upvotes: [userId], // Auto upvote by creator
            downvotes: [],
            score: 1,
            createdAt: Date.now(),
          };

          // If no track is currently playing, start it immediately!
          if (!room.currentTrack) {
            room.currentTrack = newTrack;
            room.playback = {
              isPlaying: true,
              currentTime: 0,
              lastUpdated: Date.now(),
            };
            sendSystemMessage(roomCode, `🎵 Now Playing: ${newTrack.title} (shared by ${userName})`);
          } else {
            room.queue.push(newTrack);
            // Re-sort the queue
            room.queue.sort((a, b) => b.score - a.score || a.createdAt - a.createdAt);
            sendSystemMessage(roomCode, `➕ Added to Queue: ${newTrack.title} by ${newTrack.artist}`);
          }

          broadcastRoomState(roomCode);
          break;
        }

        case "remove_track": {
          // Strictly creator/host only can remove songs from shared queue
          if (!isHost) {
            ws.send(JSON.stringify({ type: "error", message: "Only the creator can remove songs from the shared queue." }));
            break;
          }

          const { trackId } = data;
          const index = room.queue.findIndex(t => t.id === trackId);
          if (index >= 0) {
            const removed = room.queue.splice(index, 1)[0];
            sendSystemMessage(roomCode, `❌ Host removed ${removed.title} from queue.`);
            // Sort queue in case
            room.queue.sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
            broadcastRoomState(roomCode);
          }
          break;
        }

        case "vote_track": {
          const { trackId, value } = data; // value: 1 = up, -1 = down, 0 = clear
          const targetTrack = room.queue.find(t => t.id === trackId);
          if (!targetTrack) break;

          // Clean present lists
          targetTrack.upvotes = targetTrack.upvotes.filter(id => id !== userId);
          targetTrack.downvotes = targetTrack.downvotes.filter(id => id !== userId);

          if (value === 1) {
            targetTrack.upvotes.push(userId);
          } else if (value === -1) {
            targetTrack.downvotes.push(userId);
          }

          targetTrack.score = targetTrack.upvotes.length - targetTrack.downvotes.length;

          // Re-sort queue: primary score descending, secondary creation ascending
          room.queue.sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
          broadcastRoomState(roomCode);
          break;
        }

        case "skip": {
          // Creator can skip immediately
          if (!isHost) {
            ws.send(JSON.stringify({ type: "error", message: "Only the creator can trigger an immediate skip." }));
            break;
          }

          sendSystemMessage(roomCode, `⏭️ Track skipped by Host.`);
          advancePlayingTrack(room);
          broadcastRoomState(roomCode);
          break;
        }

        case "vote_skip": {
          if (!room.currentTrack) break;

          // Check if already voted
          if (room.skipVotes.includes(userId)) {
            // Unvote skip
            room.skipVotes = room.skipVotes.filter(id => id !== userId);
          } else {
            // Vote skip
            room.skipVotes.push(userId);
          }

          // Let's check skip votes target: we require >= 50% of the active participants
          const totalParticipants = room.participants.length;
          const votesRequired = Math.ceil(totalParticipants / 2);

          if (room.skipVotes.length >= votesRequired) {
            sendSystemMessage(roomCode, `🗳️ Skip vote passed (${room.skipVotes.length}/${totalParticipants} votes)! Sliding to next song.`);
            advancePlayingTrack(room);
          } else {
            sendSystemMessage(roomCode, `🗳️ Skip Vote: ${room.skipVotes.length}/${totalParticipants} participants (Needs ${votesRequired}).`);
          }

          broadcastRoomState(roomCode);
          break;
        }

        case "pause": {
          if (!isHost) {
            ws.send(JSON.stringify({ type: "error", message: "Only the creator can pause playback." }));
            break;
          }
          const { currentTime } = data;
          room.playback.isPlaying = false;
          if (typeof currentTime === "number") {
            room.playback.currentTime = currentTime;
          }
          room.playback.lastUpdated = Date.now();
          broadcastRoomState(roomCode);
          break;
        }

        case "resume": {
          if (!isHost) {
            ws.send(JSON.stringify({ type: "error", message: "Only the creator can resume playback." }));
            break;
          }
          room.playback.isPlaying = true;
          room.playback.lastUpdated = Date.now();
          broadcastRoomState(roomCode);
          break;
        }

        case "seek": {
          if (!isHost) {
            ws.send(JSON.stringify({ type: "error", message: "Only the creator can seek playing track status." }));
            break;
          }
          const { currentTime } = data;
          if (typeof currentTime === "number") {
            room.playback.currentTime = currentTime;
          }
          room.playback.lastUpdated = Date.now();
          broadcastRoomState(roomCode);
          break;
        }

        case "ping_state": {
          // Playback timeline keepalive from the creator to stay in robust lock-step
          if (isHost) {
            const { currentTime, isPlaying } = data;
            if (typeof currentTime === "number") {
              room.playback.currentTime = currentTime;
            }
            if (typeof isPlaying === "boolean") {
              room.playback.isPlaying = isPlaying;
            }
            room.playback.lastUpdated = Date.now();
            broadcastRoomState(roomCode);
          }
          break;
        }

        case "chat": {
          const { text } = data;
          if (!text || typeof text !== "string") break;

          const msg: ChatMessage = {
            id: Math.random().toString(36).substr(2, 9),
            userId,
            userName,
            text,
            timestamp: Date.now(),
            type: "chat",
          };

          room.chat.push(msg);
          if (room.chat.length > 100) room.chat.shift();

          // Broadcast explicitly
          clients.forEach((context, socket) => {
            if (context.roomCode === roomCode && socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({
                type: "chat",
                message: msg,
              }));
            }
          });
          break;
        }

        case "react": {
          // Emoji track reaction
          const { emoji } = data;
          if (!emoji) break;

          // Broadcast reaction to show floating effect on all connected participant screens
          const payload = JSON.stringify({
            type: "reaction",
            userId,
            userName,
            emoji,
            id: Math.random().toString(36).substr(2, 9),
          });

          clients.forEach((context, socket) => {
            if (context.roomCode === roomCode && socket.readyState === WebSocket.OPEN) {
              socket.send(payload);
            }
          });
          break;
        }

        default:
          break;
      }
    } catch (e) {
      console.error("WS Message Error: ", e);
    }
  });

  ws.on("close", () => {
    const clientCtx = clients.get(ws);
    if (!clientCtx) return;

    const { roomCode, userId, userName } = clientCtx;
    clients.delete(ws);

    const room = rooms.get(roomCode);
    if (room) {
      // Remove from room participants
      room.participants = room.participants.filter(p => p.userId !== userId);

      // Clean up skip votes mapping
      room.skipVotes = room.skipVotes.filter(id => id !== userId);

      sendSystemMessage(roomCode, `${userName} has left the listening circle.`);

      if (room.participants.length === 0) {
        // Destroy empty room after 20 seconds delay to free memory, allowing graceful refreshing
        setTimeout(() => {
          const r = rooms.get(roomCode);
          if (r && r.participants.length === 0) {
            rooms.delete(roomCode);
            console.log(`Destroyed empty room: ${roomCode}`);
          }
        }, 20000);
      } else if (room.hostId === userId) {
        // Creator left, nominate next participant as host immediately
        const nextHost = room.participants[0];
        room.hostId = nextHost.userId;
        nextHost.isHost = true;
        sendSystemMessage(roomCode, `👑 Host has left. ${nextHost.userName} is now the Host of the room.`);
        broadcastRoomState(roomCode);
      } else {
        broadcastRoomState(roomCode);
      }
    }
  });
});

// Helper to advance the playing track
function advancePlayingTrack(room: Room) {
  if (room.currentTrack) {
    room.history.unshift({ ...room.currentTrack });
    if (room.history.length > 50) room.history.pop();
  }

  if (room.queue.length > 0) {
    const nextTrack = room.queue.shift()!;
    room.currentTrack = nextTrack;
    room.playback = {
      isPlaying: true,
      currentTime: 0,
      lastUpdated: Date.now(),
    };
  } else {
    room.currentTrack = null;
    room.playback = {
      isPlaying: false,
      currentTime: 0,
      lastUpdated: Date.now(),
    };
  }
  room.skipVotes = []; // Reset skip votes
}

// Vite integration middleware setup for SPA
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
