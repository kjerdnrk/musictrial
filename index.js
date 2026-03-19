const express = require("express");
const YTDlpWrap = require("yt-dlp-wrap").default;
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const ytDlpPath = path.join(process.cwd(), "yt-dlp");
const ytDlp = new YTDlpWrap(ytDlpPath);

YTDlpWrap.downloadFromGithub(ytDlpPath).then(() => {
  console.log("yt-dlp ready");
}).catch(e => console.error("failed:", e));

app.get("/", (req, res) => res.send("running"));

app.post("/", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "no url" });

  // Block YouTube — it won't work from cloud IPs
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return res.status(400).json({ error: "YouTube not supported — paste a SoundCloud link instead" });
  }

  try {
    const audioUrl = await ytDlp.execPromise([
      url, "-f", "bestaudio", "--get-url", "--no-playlist"
    ]);
    return res.json({ url: audioUrl.trim(), status: "stream" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("running"));
