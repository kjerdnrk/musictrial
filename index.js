const express = require("express");
const YTDlpWrap = require("yt-dlp-wrap").default;
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const ytDlpPath = path.join(process.cwd(), "yt-dlp");
const ytDlp = new YTDlpWrap(ytDlpPath);

YTDlpWrap.downloadFromGithub(ytDlpPath).then(() => {
  console.log("yt-dlp ready");
}).catch(e => console.error("yt-dlp download failed:", e));

app.get("/", (req, res) => res.send("running"));

app.post("/", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "no url" });
  try {
    const args = [
      url,
      "-f", "bestaudio",
      "--get-url",
      "--no-playlist",
      "--extractor-args", "youtube:player_client=web",
      "--add-header", "User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    ];

    const audioUrl = await ytDlp.execPromise(args);
    return res.json({ url: audioUrl.trim(), status: "stream" });
  } catch (e) {
    console.error("yt-dlp error:", e.message);
    return res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("running on", process.env.PORT || 3000));
