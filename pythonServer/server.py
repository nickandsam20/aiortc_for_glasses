import asyncio
import uuid
import websockets
from argparse import ArgumentParser
import json
import subprocess
from aiortc import MediaStreamTrack,RTCPeerConnection, RTCSessionDescription
from aiortc.rtcconfiguration import RTCIceServer,RTCConfiguration
from aiortc.contrib.media import MediaPlayer, MediaRelay, MediaBlackhole
from aiortc.rtcrtpsender import RTCRtpSender
from aiortc.sdp import candidate_from_sdp
import sys
async def registerServer(ws,serverId):
    await ws.send(json.dumps({"operation":"registerPythonServer","serverId":serverId}))

def createProcess(uploaderId):
    subprocess.Popen([sys.executable,"streamProcess.py","-uploaderId",uploaderId])
    # subprocess.Popen(["python","streamProcess.py","-uploaderId",uploaderId],shell=True)

async def websocketClient(serverId):
    async with websockets.connect("ws://localhost:8765") as websocket:
        await registerServer(websocket,serverId)
        async for message in websocket:
            msg=json.loads(message)
            operation = msg["operation"]
            if operation == "createProcess":
                createProcess(msg["uploaderId"])
                pass
        pass
if __name__ == "__main__":
    print("----------start server ----------")
    # subprocess.Popen(["python","streamProcess.py","-uploaderId","0"],shell=True)
    parser = ArgumentParser()

    parser.add_argument("-serverId", dest="serverId")
    parser.add_argument("-modelId", dest="modelId")

    
    args = parser.parse_args()

    asyncio.run(websocketClient(args.serverId))
    print("----------close server ----------")