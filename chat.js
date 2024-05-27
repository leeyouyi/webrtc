const localVideo = document.querySelector("#localVideo");
const remoteVideos = document.querySelector("#remoteVideos");
const leaveBtn = document.querySelector("#leave");
const sendBtn = document.querySelector("#send");
const messages = document.querySelector("#messages");
const cleanBtn = document.querySelector("#clean");
const audio = document.querySelector("#audio");

let peerConnectionList = {};
let socket;
let localStream;
const room = "room1"; // 房間先預設為 room1

const hostName = location.hostname;
console.log(location.href);

const nickname = decodeURI(location.search.split("=")[1]);

/** socket 連接 */
const socketConnect = () => {
  console.log("socketConnect");
  // 伺服器連線網址：http://localhost:3000
  // socket = io("ws://34.82.53.14");
  socket = io("ws://localhost:3000");

  socket.on("connect", () => {
    console.log("client connect");
  });

  socket.on("broadcast", (msg) => {
    appendMessage(msg);
  });
  // 發送房間資訊
  socket.emit("join", room, nickname);

  // 3. 監聽有裝置加入房間
  socket.on("joined", (id, roomMembers, nickname) => {
    appendNotice(`"${nickname}" 加入聊天室`);
    // 檢查 server 傳來的 socket.id 是否等於自己的 socket.id
    // 且聊天室裝置大於一，依序發送 Offer SDP
    if (id === socket.id && roomMembers.length > 1) {
      console.log("發送 offer");
      // 3-1. 發送 Offer SDP
      roomMembers.forEach((remoteId) => {
        if (remoteId !== socket.id) {
          setOfferSDP(remoteId);
        }
      });
    }
  });
  // // 監聽加入房間
  // socket.on("ready", (msg) => {
  //   // 發送 Offer SDP
  //   sendSDP("offer");
  // });

  // 監聽收到 Offer
  socket.on("offer", async (desc, remoteId) => {
    console.log("收到 offer");
    // 4-1. 發送 Answer SDP
    console.log("發送 answer");
    await sendAnswerSDP(remoteId, desc);
  });

  // 監聽收到 Answer
  socket.on("answer", (desc, remoteId) => {
    console.log("收到 answer");
    // 設定遠端媒體串流
    peerConnectionList[remoteId].setRemoteDescription(desc);
  });

  // 監聽收到 ICE 候選位址
  socket.on("ice_candidate", (data, remoteId) => {
    console.log("收到 ice_candidate");
    // RTCIceCandidate 定義 ICE 候選位址
    const candidate = new RTCIceCandidate({
      sdpMLineIndex: data.label,
      candidate: data.candidate,
    });
    // 加入候選位址
    peerConnectionList[remoteId].addIceCandidate(candidate);
  });

  const sendText = () => {
    const message = document.querySelector("#message").value;
    socket.emit("message", { message, nickname });
    appendMessage({ message, nickname }, true);
  };
  const handleKeyUp = (e) => {
    if (e.keyCode === 13) {
      sendText();
    }
  };
  sendBtn.addEventListener("click", sendText);
  document.querySelector("#message").addEventListener("keyup", handleKeyUp);
};
// SDP 會話描述協議 Session Description Protocol
const setOfferSDP = async (remoteId) => {
  // 1. 建立 RTCPeerConnection
  const peerConnection = await createPeerConnection(remoteId);

  const offerOptions = {
    offerToReceiveAudio: true, // 是否傳送聲音流給對方
    offerToReceiveVideo: true, // 是否傳送影像流給對方
  };

  // 2. 建立本地 SDP
  const localSDP = await peerConnection.createOffer(offerOptions);

  // 3. 設定本地 SDP
  await peerConnection.setLocalDescription(localSDP);

  // 4. 發送 Offer SDP
  socket.emit(
    "offer",
    room,
    peerConnection.localDescription,
    socket.id,
    remoteId
  );
};

const sendAnswerSDP = async (remoteId, desc) => {
  // 1. 建立 RTCPeerConnection
  const peerConnection = await createPeerConnection(remoteId);

  // 2. 設定遠端 SDP
  await peerConnection.setRemoteDescription(desc);

  const answerOptions = {
    offerToReceiveAudio: true, // 是否傳送聲音流給對方
    offerToReceiveVideo: true, // 是否傳送影像流給對方
  };

  // 3. 建立本地 SDP
  const localSDP = await peerConnection.createAnswer(answerOptions);

  // 4. 設定本地 SDP
  await peerConnection.setLocalDescription(localSDP);

  // 5. 發送 Answer SDP
  socket.emit(
    "answer",
    room,
    peerConnection.localDescription,
    socket.id,
    remoteId
  );
};

// 建立本地媒體串流
const createStream = async () => {
  try {
    const constraints = { audio: true, video: true };

    // getUserMedia 取得本地影音串流
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log("stream: ", stream);
    // Dom 設置本地媒體串流
    localVideo.srcObject = stream;
    // const audioTracks = stream.getAudioTracks();
    audio.srcObject = stream;
    // 傳出媒體串流
    localStream = stream;
    // localStream 有媒體串流後建立 P2P 連線
    createPeerConnection(); // 建立 P2P 連線
  } catch (err) {
    console.log("stream: ", err.message, err.name);
  }
};

// 建立本地媒體串流
createStream();

const createPeerConnection = async (remoteId) => {
  // 1. 設定 iceServer
  const configuration = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302", // google 提供免費的 STUN server
      },
    ],
  };

  // 2. 建立 RTCPeerConnection
  const peerConnection = new RTCPeerConnection(configuration);

  // 3. 增加本地媒體串流
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  // 4. 監聽找到本地的 ICE 候選位址
  peerConnection.onicecandidate = (e) => {
    console.log("找尋到 ICE 候選位址");
    if (e.candidate) {
      console.log("發送 ICE 候選位址");
      // 傳送 ICE 候選位址給遠端
      socket.emit(
        "ice_candidate",
        room,
        {
          label: e.candidate.sdpMLineIndex,
          id: e.candidate.sdpMid,
          candidate: e.candidate.candidate,
        },
        socket.id,
        remoteId
      );
    }
  };

  // 5. 監聽 ICE 連接狀態
  peerConnection.oniceconnectionstatechange = (e) => {
    if (e.target.iceConnectionState === "disconnected") {
      console.log("有裝置斷線");

      // 移除事件監聽
      peerConnectionList[remoteId].onicecandidate = null;
      peerConnectionList[remoteId].onnegotiationneeded = null;
      peerConnectionList[remoteId].oniceconnectionstatechange = null;

      // 關閉 RTCPeerConnection 連線並釋放記憶體
      peerConnectionList[remoteId].close();
      delete peerConnectionList[remoteId];

      // 移除遠端 video
      document.getElementById(remoteId).remove();
    }
  };

  // 6. 監聽遠端裝置的串流傳入
  peerConnection.onaddstream = ({ stream }) => {
    console.log("監聽到串流");
    const video = document.createElement("video");
    video.srcObject = stream;
    video.setAttribute("controls", true);
    video.setAttribute("playsinline", true);
    video.setAttribute("autoplay", true);
    video.setAttribute("muted", true);
    video.setAttribute("volume", 0);
    video.removeAttribute("controls");
    video.classList.add("remote-video");
    video.id = remoteId;
    remoteVideos.append(video);
  };

  // 7. 將 P2P 連線存入 peerConnectionList
  peerConnectionList[remoteId] = peerConnection;

  return peerConnection;
};

// 關閉連線
const leave = () => {
  console.log("離開聊天室");

  // 檢查是否有連線
  if (Object.keys(peerConnectionList).length) {
    Object.keys(peerConnectionList).forEach((key) => {
      // 1. 移除事件監聽
      peerConnectionList[key].onicecandidate = null;
      peerConnectionList[key].onnegotiationneeded = null;
      peerConnectionList[key].oniceconnectionstatechange = null;
      // 2. 關閉 RTCPeerConnection 連線
      peerConnectionList[key].close();
    });
    // 3. 釋放記憶體
    peerConnectionList = {};

    // 4. 移除遠端 video
    remoteVideos.innerHTML = null;
  }

  // 5. 傳遞離開聊天室事件
  socket.emit("disconnect_socket");
  socket = null;

  window.location.href = "/";
};

const appendNotice = (notice) => {
  const p = document.createElement("p");
  p.style.textAlign = "center";
  const text = document.createTextNode(notice);
  p.append(text);
  messages.appendChild(p);
  document.querySelector("#message").value = "";

  const messagesBox = document.querySelector("#messagesBox");
  messagesBox.scrollTop = messagesBox.scrollHeight;
};

const appendMessage = (msg, isUser) => {
  const p = document.createElement("p");
  p.style.textAlign = !isUser ? "left" : "right";
  const text = document.createTextNode(msg.message);
  const span = document.createElement("span");
  const guest = msg.nickname !== "" ? msg.nickname : "Guest";
  const name = document.createTextNode(
    !isUser ? `${guest}: ` : `${nickname}: `
  );
  span.appendChild(name);
  p.append(name, text);
  messages.appendChild(p);
  document.querySelector("#message").value = "";

  const messagesBox = document.querySelector("#messagesBox");
  messagesBox.scrollTop = messagesBox.scrollHeight;
};

const clean = () => {
  messages.innerHTML = "";
};

leaveBtn.addEventListener("click", leave);
cleanBtn.addEventListener("click", clean);

socketConnect(); // socket 連線
