const url = "ws://localhost:8765";
let ws = new WebSocket(url);
let uploader = null,
  downloader = null,
  uploaderStream = null;
const webrtcConfig = {
  sdpSemantics: "unified-plan",
  iceCandidatePoolSize: 20,
  bundlePolicy: "max-bundle",
  iceServers: [
    // { urls: "stun:ice4.hsnl.tw:3478", username: "hsnl", credential: "hsnl33564" },
    // { urls: "turn:ice4.hsnl.tw:3478", username: "hsnl", credential: "hsnl33564" },
  ],
};
ws.onopen = () => {
  console.log("open connection");
};
ws.onmessage = (msg) => {
  let parsedMsg = JSON.parse(msg.data);
  console.log("recv:", parsedMsg);
  switch (parsedMsg["operation"]) {
    case "registerUploaderResponse":
      uploader.setRemoteDescription(parsedMsg);
      break;
    case "initDownloaderFromProcess":
      initDownloaderFromServerOrUploader(parsedMsg);
      break;
  }
};

function registerUploader() {
  let uploaderId = document.getElementById("userId").value,
    pythonServerId = document.getElementById("pythonServerId").value;
  if (uploaderId == null || uploaderId == "") {
    alert("uplaoder id can't be empty");
    return;
  }
  if (pythonServerId == null || pythonServerId == "") {
    alert("python server id can't be empty");
    return;
  }
  let pc = new RTCPeerConnection(webrtcConfig);
  uploader = pc;

  pc.addEventListener("negotiationneeded", (event) => {
    console.log("[negotiationneeded]");
  });
  pc.addEventListener("connectionstatechange", (event) => {
    console.log("connectionstatechange,current state is:", pc.connectionState);
    if (pc.connectionState == "connected") {
      document.getElementById("showUploaderConnected").style.display = "block";
    }
  });
  pc.addEventListener("icecandidate", (event) => {
    console.log("onicecandidate", event);
    if (event.candidate) {
      // console.log("sending candidate");
      // console.log(event.candidate);
    }
  });
  let videoConstraints = {
    frameRate: {
      exact: 30,
    },
    width: {
      eaxct: 640,
    },
    height: {
      exact: 480,
    },
  };
  let constraint = { video: videoConstraints };

  navigator.mediaDevices.getUserMedia(constraint).then((stream) => {
    console.log("start getting track");
    uploaderStream = stream;
    stream.getTracks().forEach((track) => {
      sender = pc.addTrack(track, stream);
      console.log("track constraints", track.getConstraints());
      console.log("track setting", track.getSettings());
    });

    console.log("finish add local track");
    console.log("start negotiate");
    setMaxCapability();
    negotiate(pc, "registerUploader", pythonServerId, uploaderId);
  });
}
function negotiate(_pc, operation, pythonServerId, userId) {
  return _pc
    .createOffer()
    .then((offer) => {
      return _pc.setLocalDescription(offer);
    })
    .then(() => {
      // wait for ICE gathering to complete
      console.log("start gathering ice");
      return new Promise((resolve) => {
        if (_pc.iceGatheringState === "complete") {
          resolve();
        } else {
          const checkState = () => {
            if (_pc.iceGatheringState === "complete") {
              _pc.removeEventListener("icegatheringstatechange", checkState);
              resolve();
            }
          };
          _pc.addEventListener("icegatheringstatechange", checkState);
        }
      });
    })
    .then(() => {
      console.log("ice gathering finish");
      let offer = _pc.localDescription;
      let msg = {
        sdp: offer.sdp,
        type: offer.type,
        operation: operation,
        pythonServerId: pythonServerId,
        userId: userId,
      };

      ws.send(JSON.stringify(msg));
    });
}

function registerDownloader() {
  let downloaderId = document.getElementById("userId").value,
    connectToUserId = document.getElementById("connectToUserId").value;
  ws.send(JSON.stringify({ operation: "registerDownloader", downloaderId: downloaderId, connectToUserId: connectToUserId }));
}

async function initDownloaderFromServerOrUploader(parsedMessage) {
  let pc = new RTCPeerConnection(webrtcConfig);
  let processSessionId = parsedMessage["processSessionId"];
  downloader = pc;

  pc.addEventListener("connectionstatechange", (event) => {
    console.log(`[connectionstatechange], downloader current state is:`, pc.connectionState);
  });
  pc.addEventListener("negotiationneeded", (event) => {
    console.log("[negotiationneeded]");
  });
  pc.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      // ws.send(
      //   JSON.stringify({
      //     operation: "clientOnIce",
      //     candidate: event.candidate,
      //     serverSessionId: streamServerSessionId,
      //   })
      // );
    }
  });
  // connect audio / video
  pc.addEventListener("track", (evt) => {
    console.log(`[on track] kind:${evt.track.kind}, id:${evt.track.id},streamId:${evt.streams[0].id}`);
    let streamId = evt.streams[0].id;
    if (evt.track.kind == "video") {
      document.getElementById("videoContainer").style.display = "block";
      //   $("#videoContainer").css("display", "block");
      document.getElementById("remoteVideo").srcObject = evt.streams[0];
      setInterval(getFps, 300);
    } else {
      // document.getElementById("audio").srcObject = evt.streams[0];
    }
  });

  pc.setRemoteDescription(parsedMessage).then(() => {
    pc.createAnswer()
      .then(async (answer) => {
        await pc.setLocalDescription(answer);
        return answer;
      })
      .then(() => {
        // wait for ICE gathering to complete
        console.log("[start gathering ice]");
        return new Promise((resolve) => {
          if (pc.iceGatheringState === "complete") {
            resolve();
          } else {
            const checkState = () => {
              if (pc.iceGatheringState === "complete") {
                pc.removeEventListener("icegatheringstatechange", checkState);
                resolve(pc.localDescription);
              }
            };
            pc.addEventListener("icegatheringstatechange", checkState);
          }
        });
      })
      .then((answer) => {
        // Send the answer to the remote peer through the signaling server.
        console.log(`iceGathering state:`, pc.iceGatheringState);
        ws.send(
          JSON.stringify({
            operation: "downloaderAns",
            sdp: answer.sdp,
            type: answer.type,
            processSessionId: processSessionId,
          })
        );
      });
  });
}

function debug() {
  ws.send(JSON.stringify({ operation: "debug" }));
}

//設定上傳方影片為最高fps跟寬高(需要從uploader端呼叫!!)
function setMaxCapability() {
  let cap = uploaderStream.getVideoTracks()[0].getCapabilities();
  console.log(cap);
  uploaderStream
    .getVideoTracks()[0]
    .applyConstraints({ fps: { exact: cap.frameRate.max }, width: { exact: cap.width.max }, height: { exact: cap.height.max } });
}

//設定上傳方影片的寬跟高(需要從uploader端呼叫!!)
function setWH(w, h) {
  uploaderStream.getVideoTracks()[0].applyConstraints({ width: { exact: w }, height: { exact: h } });
}

function getFps() {
  downloader.getStats(null).then((stats) => {
    stats.forEach((report) => {
      if (report.type == "inbound-rtp" && report.kind == "video") {
        // console.log(report);
        // console.log(`fps:${report.framesPerSecond}, jitter:${report.jitter}`);
        let element = document.getElementById(`remoteVideoFps`),
          fps = report.framesPerSecond;
        if (element != null) {
          element.innerHTML = `fps:${fps},w:${report.frameWidth},h:${report.frameHeight}`;
        }
      }
    });
  });
}
