const express = require("express");
const YTDlpWrap = require("yt-dlp-wrap").default;
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const ytDlp = new YTDlpWrap();

app.post("/", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "no url" });
  try {
    const directUrl = await ytDlp.execPromise([url, "-f", "bestaudio", "--get-url"]);
    return res.json({ url: directUrl.trim(), status: "stream" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("running"));
