const express = require("express");
const app = express();
const { createServer } = require("http");
// const socket = require("socket.io");
const { Server } = require("socket.io");

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://34.82.53.14",
  },
});

// const server = http.createServer(app).listen("3000");

// html 路徑轉換
app.get("/", function (req, res) {
  res.sendFile(`${__dirname}/chat.html`);
});

// js 路徑轉換
app.get(/(.*)\.(jpg|gif|png|ico|css|js|txt)/i, function (req, res) {
  res.sendFile(`${__dirname}/${req.params[0]}.${req.params[1]}`);
});

io.on("connection", (socket) => {
  console.log("connection");
  let roomNumber;
  // 加入房間
  socket.on("join", (room) => {
    console.log("join");
    console.log({ room });
    roomNumber = room;
    socket.join(room);
    // 取得加入聊天室裝置的 socket.id
    const members = Array.from(socket.adapter.rooms.get(room));
    console.log({ members });
    // 向所有裝置告知有新裝置加入（包含自己）
    io.in(room).emit("joined", socket.id, members);
  });

  // 傳送訊息
  socket.on("message", (message) => {
    console.log(message);
    // io.emit("broadcast", message);
    socket.to(roomNumber).emit("broadcast", message);
  });

  // 轉傳 Offer
  socket.on("offer", (room, desc, remoteId, localId) => {
    socket.to(localId).emit("offer", desc, remoteId);
  });

  // 轉傳 Answer
  socket.on("answer", (room, desc, remoteId, localId) => {
    socket.to(localId).emit("answer", desc, remoteId);
  });

  // 交換 ice candidate
  socket.on("ice_candidate", (room, data, remoteId, localId) => {
    // console.log("ice_candidate", data);
    // console.log("remoteIde", remoteId);
    // console.log("localId", localId);
    socket.to(localId).emit("ice_candidate", data, remoteId);
  });
  // 裝置離開聊天室
  socket.on("disconnect_socket", () => {
    console.log("disconnect");
    socket.disconnect();
  });
  // 關閉通話
  socket.on("hangup", (room) => {
    console.log("hangup");
    socket.leave(room);
  });
});

httpServer.listen(3000, () =>
  console.log("Server is running on http://localhost:3000")
);
