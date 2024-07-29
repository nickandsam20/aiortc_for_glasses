const express = require("express");
const path = require("path");

const app = express();
const port = 3000;

// 設定靜態檔案目錄
app.use(express.static(path.join(__dirname, "public")));

// 處理根路徑的 GET 請求
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// // 處理其他路徑的 GET 請求，例如 /about
// app.get("/about", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "about.html"));
// });

// 啟動伺服器
app.listen(port, () => {
  console.log(`Express 伺服器正在 port ${port} 啟動...`);
});
