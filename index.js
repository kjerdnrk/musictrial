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
    if (fs.existsSync(ytDlpPath)) { console.log("yt-dlp exists"); return resolve(); }
    console.log("Downloading yt-dlp...");
    const file = fs.createWriteStream(ytDlpPath);
    function download(url) {
      https.get(url, function(res) {
        if (res.statusCode === 301 || res.statusCode === 302) return download(res.headers.location);
        res.pipe(file);
        file.on("finish", function() {
          file.close();
          fs.chmodSync(ytDlpPath, "755");
          console.log("yt-dlp ready");
          resolve();
        });
      }).on("error", reject);
    }
    download("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp");
  });
}

function runYtDlp(args) {
  return new Promise(function(resolve, reject) {
    execFile(ytDlpPath, args, { timeout: 60000 }, function(err, stdout, stderr) {
      console.log("stderr:", stderr && stderr.substring(0, 300));
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

app.get("/", function(req, res) { res.send("running"); });

app.post("/", async function(req, res) {
  var url = req.body && req.body.url;
  if (!url) return res.status(400).json({ error: "no url" });
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return res.status(400).json({ error: "YouTube not supported" });
  }

  try {
    // Get JSON info — works for both single tracks and playlists
    const stdout = await runYtDlp([
      url,
      "-j",
      "--flat-playlist", // fast — gets metadata without downloading
      "--no-warnings",
    ]);

    // Each line is a JSON object (one per track)
    const lines = stdout.trim().split("\n").filter(l => l.trim());
    
    if (lines.length === 0) return res.status(500).json({ error: "no tracks found" });

    if (lines.length === 1) {
      // Single track — return direct audio URL
      const info = JSON.parse(lines[0]);
      // Get actual stream URL
      const streamOut = await runYtDlp([
        info.webpage_url || url,
        "-f", "bestaudio/best",
        "--get-url",
        "--no-playlist",
      ]);
      const streamUrl = streamOut.trim().split("\n").filter(l => l.startsWith("http"))[0];
      if (!streamUrl) return res.status(500).json({ error: "no stream url" });
      return res.json({ url: streamUrl, status: "stream", title: info.title });
    }

    // Playlist — return all track source URLs for client to queue
    const tracks = lines.map(l => {
      try {
        const info = JSON.parse(l);
        return { url: info.webpage_url || info.url, title: info.title || "Unknown" };
      } catch(_) { return null; }
    }).filter(Boolean);

    return res.json({ playlist: tracks, status: "playlist" });

  } catch(e) {
    console.error("error:", e.message);
    return res.status(500).json({ error: e.message });
  }
});

downloadYtDlp().then(function() {
  app.listen(process.env.PORT || 3000, function() {
    console.log("running on port", process.env.PORT || 3000);
  });
}).catch(function(e) {
  console.error("startup failed:", e.message);
  process.exit(1);
});
