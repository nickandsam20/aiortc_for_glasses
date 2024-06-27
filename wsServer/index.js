const express = require("express");
const SocketServer = require("ws").Server;
const PORT = 8765; //指定 port

const server = express().listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});

const wss = new SocketServer({ server });

const { v4 } = require("uuid");
let servers = {}; //serverId:PythonServer
let uploaders = {}; //uploaderId:Uploader
let downloaders = {}; //downloaderId:Downloader
let streamProcesses = {}; //processSessionId:StreamProcess
let sessionId2RealId = {};
class PythonServer {
  constructor(ws, id, sessionId) {
    (this.ws = ws), (this.id = id), (this.sessionId = sessionId);
  }
}
//streamProcess的id等於sessionId!
class StreamProcess {
  constructor(ws, sessionId) {
    (this.ws = ws), (this.id = sessionId), (this.sessionId = sessionId);
  }
}
class Uploader {
  constructor(ws, id, pythonServerId, sdp, type, sessionId) {
    (this.ws = ws),
      (this.id = String(id)),
      (this.pythonServerId = pythonServerId),
      (this.sdp = sdp),
      (this.type = type),
      (this.sessionId = sessionId);
    this.processId = null;
  }
}
class Downloader {
  constructor(ws, id, sessionId, pythonServerId, processId) {
    (this.ws = ws), (this.id = String(id)), (this.pythonServerId = pythonServerId), (this.sessionId = sessionId);
    this.processId = processId;
  }
}

function registerPythonServer(parsedMsg, ws, sessionId) {
  let serverId = parsedMsg.serverId;
  servers[serverId] = new PythonServer(ws, serverId, sessionId);
  sessionId2RealId[sessionId] = serverId;
}
function registerStreamProcess(parsedMsg, ws, sessionId) {
  let uploaderId = String(parsedMsg.uploaderId);
  if (!uploaderExist(uploaderId)) {
    console.log(`[registerStreamProcess]uploder ${uploaderId} not exist`);
    return;
  }
  let process = new StreamProcess(ws, sessionId),
    uploader = uploaders[uploaderId];
  streamProcesses[sessionId] = process;
  //streamProcess的id等於sessionId!
  sessionId2RealId[sessionId] = sessionId;
  uploader.processId = sessionId;
  ws.send(JSON.stringify({ operation: "registerUploaderWithProcess", sdp: uploader.sdp, type: uploader.type, uploaderId: uploaderId }));
}
function registerUploader(parsedMsg, ws, sessionId) {
  let uploaderId = String(parsedMsg.userId),
    pythonServerId = String(parsedMsg.pythonServerId),
    sdp = parsedMsg.sdp,
    type = parsedMsg.type;
  if (uploaderExist(uploaderId)) {
    console.log(`[registerUploader]uploader ${uploaderId} already exist`);
    return;
  }
  if (!pythonServerExist(pythonServerId)) {
    console.log(`[registerUploader]python server ${pythonServerId} not exist`);
    return;
  }
  sessionId2RealId[sessionId] = uploaderId;
  uploaders[uploaderId] = new Uploader(ws, uploaderId, pythonServerId, sdp, type, sessionId);
  let pythonServer = servers[pythonServerId];
  pythonServer.ws.send(JSON.stringify({ operation: "createProcess", uploaderId: uploaderId }));
}

function registerDownloader(parsedMsg, ws, sessionId) {
  let downloaderId = String(parsedMsg.downloaderId),
    uploaderId = String(parsedMsg.connectToUserId);
  if (downloaderExist(downloaderExist)) {
    console.log(`[registerDownloader]downloader ${downloaderId} already exist`);
    return;
  }
  if (!uploaderExist(uploaderId)) {
    console.log(`[registerDownloader]uploader ${uploaderId} not exist`);
    return;
  }
  let uploader = uploaders[uploaderId],
    processId = uploader.processId;

  if (!processExist(processId)) {
    console.log(`[registerDownloader]process not exist`);
    return;
  }
  let process = streamProcesses[uploader.processId];
  downloaders[downloaderId] = new Downloader(ws, downloaderId, sessionId, uploader.pythonServerId, processId);
  sessionId2RealId[sessionId] = downloaderId;
  process.ws.send(JSON.stringify({ operation: "createDownloader", downloaderId: downloaderId }));
}

function downloaderExist(downloaderId) {
  if (downloaderId in downloaders && downloaders[downloaderId] != null) return true;
  return false;
}
function uploaderExist(uploaderId) {
  if (uploaderId in uploaders && uploaders[uploaderId] != null) return true;
  return false;
}

function pythonServerExist(serverId) {
  if ((serverId in servers) & (servers[serverId] != null)) return true;
  return false;
}

function processExist(processId) {
  if (processId in streamProcesses && streamProcesses[processId] != null) return true;
  return false;
}
function handleSessionClose(sessionId) {
  let id = sessionId2RealId[sessionId];
  console.log(`[handleSessionClose]deleting id ${id},sessionId ${sessionId}`);
  try {
    if (id in servers) {
      delete servers[id];
    } else if (id in downloaders) {
      delete downloaders[id];
    } else if (id in uploaders) {
      delete uploaders[id];
    } else if (id in streamProcesses) {
      delete streamProcesses[id];
    }
  } finally {
    delete sessionId2RealId[sessionId];
  }
}

wss.on("connection", function connection(ws) {
  let sessionId = v4();
  ws.on("error", console.error);
  ws.on("close", function close() {
    console.log("close");
    handleSessionClose(sessionId);
  });

  ws.on("message", function message(data) {
    data = JSON.parse(data);
    console.log("received: %s", data.operation);
    switch (data.operation) {
      case "registerPythonServer":
        registerPythonServer(data, ws, sessionId);
        break;
      case "registerUploader":
        registerUploader(data, ws, sessionId);
        break;
      case "registerProcess":
        registerStreamProcess(data, ws, sessionId);
        break;
      case "registerUploaderResponse":
        let uploaderId = data["uploaderId"];
        if (!uploaderExist(uploaderId)) {
          console.log(`[registerUploaderResponse]uploader not exist`);
          return;
        }
        // console.log(data);
        uploaders[uploaderId].ws.send(JSON.stringify(data));
        break;
      case "registerDownloader":
        registerDownloader(data, ws, sessionId);
        break;
      case "initDownloaderFromProcess":
        data["processSessionId"] = sessionId;
        let downloaderId = String(data["downloaderId"]);
        if (!downloaderExist(downloaderId)) {
          console.log(`[initDownloaderFromProcess]downloader ${downloaderId} not exist`);
          return;
        }
        let downloader = downloaders[downloaderId];
        downloader.ws.send(JSON.stringify(data));
        //送給downloader,須加上ProcessId才能讓downlader回傳anser時知道要回傳給哪一個process
        break;
      case "downloaderAns":
        let processId = String(data["processSessionId"]);
        if (!processExist(processId)) {
          console.log(`[downloaderAns]process ${processSessionId} not exist`);
          return;
        }
        let process = streamProcesses[processId];
        process.ws.send(JSON.stringify(data));
        break;
      case "debug":
        console.log(`uploaders`, Object.keys(uploaders));
        console.log(`downloaders`, Object.keys(downloaders));
        console.log(`servers`, Object.keys(servers));
        console.log(`streamProcesses`, Object.keys(streamProcesses));
        console.log(`sessionId2RealId`, sessionId2RealId);
        break;
    }
  });
});
