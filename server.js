const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const rooms = new Map();

app.use(express.static(path.join(__dirname, "public")));

app.use((req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

function code() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function send(ws, msg) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

wss.on("connection", (ws) => {
  ws.room = null;
  ws.player = null;

  ws.on("message", (raw) => {
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }

    if (m.type === "create") {
      let c = code();
      while (rooms.has(c)) c = code();

      rooms.set(c, { players: [ws] });
      ws.room = c;
      ws.player = 1;

      send(ws, {
        type: "room",
        code: c,
        player: 1
      });

    } else if (m.type === "join") {
      const c = String(m.code || "").toUpperCase();
      const r = rooms.get(c);

      if (!r || r.players.length >= 2) {
        send(ws, {
          type: "error",
          message: "Room not found or full."
        });
        return;
      }

      r.players.push(ws);
      ws.room = c;
      ws.player = 2;

      r.players.forEach((p, i) => {
        send(p, {
          type: "ready",
          code: c,
          player: i + 1
        });
      });

    } else if (ws.room) {
      const r = rooms.get(ws.room);
      if (!r) return;

      if (m.type === "score") {
        r.players.forEach((p) => {
          if (p !== ws) {
            send(p, {
              type: "opponentScore",
              score: Number(m.score) || 0
            });
          }
        });
      }

      if (m.type === "gameover") {
        r.players.forEach((p) => {
          if (p !== ws) {
            send(p, {
              type: "opponentOver",
              score: Number(m.score) || 0
            });
          }
        });
      }
    }
  });

  ws.on("close", () => {
    if (ws.room && rooms.has(ws.room)) {
      const r = rooms.get(ws.room);

      r.players = r.players.filter((p) => p !== ws);

      r.players.forEach((p) => {
        send(p, { type: "opponentLeft" });
      });

      if (r.players.length === 0) {
        rooms.delete(ws.room);
      }
    }
  });
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("Sky Hopper Online on " + PORT);
});
