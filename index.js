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
  return new Promise(function(resolve, reject) {
    if (fs.existsSync(ytDlpPath)) {
      console.log("yt-dlp exists");
      return resolve();
    }
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

function runYtDlp(url) {
  return new Promise(function(resolve, reject) {
    execFile(ytDlpPath, [url, "-j", "--no-playlist"], { timeout: 60000 },
      function(err, stdout, stderr) {
        console.log("stderr:", stderr && stderr.substring(0, 300));
        if (err) return reject(new Error(stderr || err.message));
        try {
          var info = JSON.parse(stdout);
          var formats = (info.formats || [])
            .filter(function(f) { return f.url && f.acodec !== "none"; })
            .sort(function(a, b) { return (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0); });
          if (formats.length > 0) return resolve(formats[0].url);
          if (info.url) return resolve(info.url);
          reject(new Error("no url found"));
        } catch(e) {
          reject(new Error("parse error: " + stdout.substring(0, 300)));
        }
      }
    );
  });
}

function getPlaylistUrls(url) {
  return new Promise(function(resolve, reject) {
    execFile(ytDlpPath, [url, "-j", "--flat-playlist", "--no-warnings"], { timeout: 60000 },
      function(err, stdout, stderr) {
        if (err) return reject(new Error(stderr || err.message));
        var lines = stdout.trim().split("\n").filter(function(l) { return l.trim(); });
        var tracks = lines.map(function(l) {
          try {
            var info = JSON.parse(l);
            return { url: info.webpage_url || info.url, title: info.title || "Unknown" };
          } catch(_) { return null; }
        }).filter(Boolean);
        resolve(tracks);
      }
    );
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
    var isPlaylist = url.includes("/sets/") || url.includes("playlist");
    if (isPlaylist) {
      var tracks = await getPlaylistUrls(url);
      return res.json({ playlist: tracks, status: "playlist" });
    }
    var audioUrl = await runYtDlp(url);
    return res.json({ url: audioUrl, status: "stream" });
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
