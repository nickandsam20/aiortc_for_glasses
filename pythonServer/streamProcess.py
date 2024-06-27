import asyncio
from argparse import ArgumentParser
import json
from aiortc import MediaStreamTrack,RTCPeerConnection, RTCSessionDescription
from aiortc.rtcconfiguration import RTCIceServer,RTCConfiguration
from aiortc.contrib.media import MediaPlayer, MediaRelay, MediaBlackhole
from aiortc.rtcrtpsender import RTCRtpSender
from aiortc.sdp import candidate_from_sdp
from av import VideoFrame
import websockets
import cv2

uploader=None
downloader=None
webRtcConfig = RTCConfiguration(iceServers=[ 
    RTCIceServer(urls="stun:ice4.hsnl.tw:3478",username="hsnl2",credential="hsnl33564"),
    RTCIceServer(urls="turn:ice4.hsnl.tw:3478",username="hsnl2",credential="hsnl33564"),
])

class VideoTransformTrack(MediaStreamTrack):
    kind = "video"
    def __init__(self, track):
        super().__init__()  # don't forget this!
        self.track = track
    def stop(self):
        super().stop()
        self.track.stop() 
    async def recv(self):
        frame = await self.track.recv()
        global uploader,torchModel,modelOn
        try:   
            #這邊可以自己對frame加工
            #img0 = frame.to_ndarray(format="bgr24")
            # new_frame  = VideoFrame.from_ndarray(im0, format="bgr24")
            # new_frame.pts = frame.pts
            # new_frame.time_base = frame.time_base
            img = frame.to_ndarray(format="bgr24")
            rows, cols, _ = img.shape
            M = cv2.getRotationMatrix2D((cols / 2, rows / 2), frame.time * 45, 1)
            img = cv2.warpAffine(img, M, (cols, rows))
            new_frame = VideoFrame.from_ndarray(img, format="bgr24")
            new_frame.pts = frame.pts
            new_frame.time_base = frame.time_base
            return new_frame   
        except Exception as e:
            print("error in VideoTransformTrack",e)
            return frame
class User():
    def __init__(self, uid,pc=None):
        self.id=uid #session id
        self.pc=pc #peerConnection object
        self.isClose=False


class Uploader(User):
    def __init__(self,uid,pc):
        super().__init__(uid,pc)
        self.videoTrack=None
        self.originVideoTrack=None
        self.audioTrack=None
        self.blackHole=MediaBlackhole()
        self.relay=MediaRelay()
    def addVideoTrack(self,track):
        self.originVideoTrack=track
        self.videoTrack=VideoTransformTrack(track)
    def addAudioTrack(self,track):
        self.audioTrack=track

class Downloader(User):
    def __init__(self,uid,pc=None):
        super().__init__(uid,pc)

async def closeUploader(ws):
    global uploader,downloader
    if uploader is None:
        return
    _uploader = uploader
    uploader = None
    await _uploader.blackHole.stop()
    await _uploader.pc.close()
    if downloader is None:
            await ws.close()
async def closeDownloader(ws):
    global uploader,downloader
    if downloader is None:
        return
    _downloader = downloader
    downloader = None
    await _downloader.pc.close()
    if uploader is None:
        await ws.close()
async def registerProcess(ws,uploaderId):
    await ws.send(json.dumps({"operation":"registerProcess","uploaderId":uploaderId}))

async def createDownloader(ws,message):
    global downloader,uploader
   
    downloaderId = message['downloaderId']
    
    pc = RTCPeerConnection(webRtcConfig)
    
    downloader = Downloader(downloaderId, pc)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        print("[connectionstatechange] Connection uid %s state is %s" % (downloaderId,pc.connectionState))
        if pc.connectionState == "failed" or pc.connectionState=="closed":
            await closeDownloader(ws)

    
    if uploader is not None : 
        await uploader.blackHole.stop()
        if uploader.videoTrack:
            pc.addTrack(uploader.relay.subscribe(uploader.videoTrack,False))

    # channel = pc.createDataChannel("chat")
    offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    await ws.send(json.dumps({"operation":"initDownloaderFromProcess", "sdp": pc.localDescription.sdp, 
                "type": pc.localDescription.type,"downloaderId":downloaderId}))

async def recvDownloaderAns(ws,message):
    global downloader
    answer = RTCSessionDescription(sdp=message["sdp"], type=message["type"]) 
    await downloader.pc.setRemoteDescription(answer)

async def createUploader(ws,message):
    global uploader,downloaders
    uploaderId = message['uploaderId']



    offer = RTCSessionDescription(sdp=message["sdp"], type=message["type"])

    pc = RTCPeerConnection(webRtcConfig)

    _uploader = Uploader(uploaderId,pc)
    uploader= _uploader
  
 
    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        print("[connectionstatechange] uploader id:%s,  connection state is %s" % (uploaderId,pc.connectionState))
        if pc.connectionState == "failed" or pc.connectionState == "closed":
            print("[close peer connection] id:%s"%uploaderId)
            await closeUploader(ws)

    @pc.on("track")
    async def onTrack(_track):
        if _track.kind == "audio":
            print('recv audio track!!!!!')
            _uploader.addAudioTrack(_track)
            return
        _uploader.addVideoTrack(_track)
        
        _uploader.blackHole.addTrack(uploader.videoTrack)#重要,一定要記得如果沒有其他cosumer則需要把track丟進blackHole,否則frame會一直累積在記憶體中
        await _uploader.blackHole.start()
    
    await pc.setRemoteDescription(offer)
    

    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    await ws.send(json.dumps({"operation":"registerUploaderResponse","sdp": pc.localDescription.sdp, 
            "type": pc.localDescription.type, 'uploaderId':uploaderId}))
    
async def websocketClient(uploaderId):
    async with websockets.connect("ws://localhost:8765") as websocket:
        await registerProcess(websocket,uploaderId)
        async for message in websocket:
            msg=json.loads(message)
            operation = msg["operation"]
            print("recv operation :%s"%operation)
            if operation == "registerUploaderWithProcess":
                asyncio.create_task(createUploader(websocket,msg))
            elif operation =="createDownloader":
                asyncio.create_task(createDownloader(websocket,msg))
            elif operation == "downloaderAns":
                asyncio.create_task(recvDownloaderAns(websocket,msg))
            

if __name__ == "__main__":
    print("----------start stream process----------")
    parser = ArgumentParser()

    parser.add_argument("-uploaderId", dest="uploaderId")

    
    args = parser.parse_args()

    asyncio.run(websocketClient(args.uploaderId))
    print("----------finish stream process----------")