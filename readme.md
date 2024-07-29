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
3. 進入frontend資料夾,輸入``` node server.js```開啟前端伺服器,前端伺服器預設會開啟在本地的3000 port,這樣就可以從3000 port access 網頁,或是直接點選frontend資料夾中的index.html(請開啟兩個, 一個做為上傳影片方,一個做為下載影片方)
    1. 上傳方請填入"my user id"欄位跟"to python server id"欄位,"my user id"為這個uploader的id可以隨便設,"to python server id"請填選剛剛開啟的pythonServer的id
    2. 等待uploader與pythonServer連線(當成功連線時會在螢幕上顯示uploader已成功連線),請等uploader成功連線後再進行第3部(連線downloader)
    3. 下載方請填入"my user id"跟"connectToUserId","my user id"欄位代表這個downloader的id可以隨便設,"connectToUserId"請填入想要連線到的uploader的id
4. 此時downloader葉面應該就能看到uploader方拍攝到的畫面,並且是經過影像處理(目前會用cv2來把影像自動旋轉,<font color="red">可自行修改./pythonServer/streamProcess.py中的VideoTransformTrack這個class內部的recv method,將其回傳的frame修改為想要做的處理</font>)
5. 
* [注意] <font color="red">請確認所有東西的id都不能重複!!!</font>

# 其他注意事項:
* 在uploader的頁面可以呼叫setWH(w,h)傳入想要設定的uploader上傳的影片解析度來調整上傳的影片
* 在uploader的頁面可以呼叫setMaxCapability來把上傳者的影片解析度跟fps調整到其攝影機的上限
* setWH跟setMaxCapability需要在uplaoder方呼叫才有用,並且webrtc協議會自動根據當前網路環境跟接收/傳送方的資源幫你自動調整畫質(影片壓縮率),解析度(WH)跟fps,且這個自動調整功能無法關閉T_T,因此如果發現畫質/fps/寬高被自動調整時,我們只能在uploader端呼叫setWH或是setMaxCapability請求webrtc library把畫質跟fps調成我們想要的