const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const https = require("https");
const { execFile } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

const ytDlpPath = path.join(process.cwd(), "yt-dlp");

function downloadYtDlp() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(ytDlpPath)) { console.log("yt-dlp already exists"); return resolve(); }
    const url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
    console.log("Downloading yt-dlp...");
    const file = fs.createWriteStream(ytDlpPath);
    https.get(url, res => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        https.get(res.headers.location, res2 => {
          res2.pipe(file);
          file.on("finish", () => { file.close(); fs.chmodSync(ytDlpPath, "755"); resolve(); });
        }).on("error", reject);
      } else {
        res.pipe(file);
        file.on("finish", () => { file.close(); fs.chmodSync(ytDlpPath, "755"); resolve(); });
      }
    }).on("error", reject);
  });
}

function runYtDlp(url) {
  return new Promise((resolve, reject) => {
    // First get video info to debug
    execFile(ytDlpPath, [
      url,
      "-f", "bestaudio/best",
      "--get-url",
      "--no-playlist",
      "--verbose",
    ],
      { timeout: 30000 },
      (err, stdout, stderr) => {
        console.log("STDOUT:", stdout);
        console.log("STDERR:", stderr);
        if (err) return reject(new Error(stderr || err.message));
        const lines = stdout.split("\n").map(l => l.trim()).filter(l => l.startsWith("http"));
        console.log("URL lines:", lines);
        if (lines.length === 0) return reject(new Error("no url returned. stdout: " + stdout.substring(0, 500)));
        resolve(lines[0]);
      }
    );
  });
}

app.get("/", (req, res) => res.send("running"));

app.post("/", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "no url" });
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return res.status(400).json({ error: "YouTube not supported — use SoundCloud" });
  }
  try {
    const audioUrl = await runYtDlp(url);
    return res.json({ url: audioUrl, status: "stream" });
  } catch (e) {
    console.error("Error:", e.message);
    return res.status(500).json({ error: e.message });
  }
});

downloadYtDlp()
  .then(() => app.listen(process.env.PORT || 3000, () => console.log("running")))
  .catch(e => { console.error("Failed:", e); process.exit(1); });
