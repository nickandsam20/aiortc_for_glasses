# 本repo功能
可以讓兩個用戶a(瀏覽器)將影片使用webrtc傳送到pythonServer後,由pythonServer對影片的frame作處理後再透過webrtc送給用戶b(瀏覽器)
# 環境安裝
1. 進入pythonServer 資料夾後
    - ```pip install websockets```
    - ```pip install aiortc```
    - ```pip install av```
    - ```pip install opencv-python```
2. 進入wsServery 資料夾後
    - ```npm install```
# 使用方法:
1. 進入wsServer資料夾後使用```node index.js```開啟websocket server(預設會在8765 port)
2. 進入pythonServer資料夾,使用以下指令開啟server,serverId請填入想要設定的serverId
    ```python server.py -serverId <serverId>```
3. 點選frontend資料夾中的index.html(請開啟兩個, 一個做為上傳影片方,一個做為下載影片方)
    1. 上傳方請填入<my user id>欄位跟<to python server id>欄位,<my user id>為這個uploader的id可以隨便設,<to python server id>請填選剛剛開啟的pythonServer的id
    2. 等待uploader與pythonServer連線(當成功連線時會在螢幕上顯示uploader已成功連線),請等uploader成功連線後再進行第3部(連線downloader)
    3. 下載方請填入<my user id>跟<connectToUserId >,<my user id>欄位代表這個downloader的id可以隨便設,<connectToUserId>請填入想要連線到的uploader的id
4. 此時downloader葉面應該就能看到uploader方拍攝到的畫面,並且是經過影像處理(目前會用cv2來把影像自動旋轉,<font color="red">可自行修改./pythonServer/streamProcess.py中的VideoTransformTrack這個class內部的recv method,將其回傳的frame修改為想要做的處理</font>)
* [注意] <font color="red">請確認所有東西的id都不能重複!!!</font>