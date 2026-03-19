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
          file.on("finish", () => {
            file.close();
            fs.chmodSync(ytDlpPath, "755");
            console.log("yt-dlp downloaded");
            resolve();
          });
        }).on("error", reject);
      } else {
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          fs.chmodSync(ytDlpPath, "755");
          console.log("yt-dlp downloaded");
          resolve();
        });
      }
    }).on("error", reject);
  });
}

function runYtDlp(url) {
  return new Promise((resolve, reject) => {
    execFile(ytDlpPath, [url, "-f", "bestaudio", "--get-url", "--no-playlist"], 
      { timeout: 30000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        // Take first non-empty line
        const lines = stdout.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) return reject(new Error("no url returned"));
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
    return res.status(500).json({ error: e.message });
  }
});

downloadYtDlp()
  .then(() => app.listen(process.env.PORT || 3000, () => console.log("running")))
  .catch(e => { console.error("Failed to download yt-dlp:", e); process.exit(1); });
