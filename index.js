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
  return new Promise(function (resolve, reject) {
    console.log("Downloading latest yt-dlp...");
    const file = fs.createWriteStream(ytDlpPath);
    function download(url) {
      https
        .get(url, function (res) {
          if (res.statusCode === 301 || res.statusCode === 302)
            return download(res.headers.location);
          res.pipe(file);
          file.on("finish", function () {
            file.close();
            fs.chmodSync(ytDlpPath, "755");
            console.log("yt-dlp ready");
            resolve();
          });
        })
        .on("error", reject);
    }
    download(
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
    );
  });
}

// Always re-download on startup so we always have the latest version.
// SoundCloud breaks with stale yt-dlp — this is the #1 fix.
function ensureYtDlp() {
  return downloadYtDlp();
}

function runYtDlp(url) {
  return new Promise(function (resolve, reject) {
    const args = [
      url,
      "-j",
      "--no-playlist",
      "--no-warnings",
      "--extractor-retries", "3",
      "--socket-timeout", "30",
    ];
    execFile(ytDlpPath, args, { timeout: 90000 }, function (err, stdout, stderr) {
      if (stderr && stderr.trim()) {
        console.log("yt-dlp stderr:", stderr.substring(0, 500));
      }
      if (err) {
        const msg = (stderr && stderr.trim()) || err.message || "unknown error";
        return reject(new Error(msg));
      }
      try {
        const info = JSON.parse(stdout);
        const formats = (info.formats || [])
          .filter(function (f) {
            return f.url && f.acodec !== "none";
          })
          .sort(function (a, b) {
            return (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0);
          });
        if (formats.length > 0) return resolve(formats[0].url);
        if (info.url) return resolve(info.url);
        reject(new Error("no audio url found in yt-dlp output"));
      } catch (e) {
        reject(new Error("parse error: " + stdout.substring(0, 300)));
      }
    });
  });
}

function getPlaylistUrls(url) {
  return new Promise(function (resolve, reject) {
    const args = [
      url,
      "-j",
      "--flat-playlist",
      "--no-warnings",
      "--socket-timeout", "30",
    ];
    execFile(ytDlpPath, args, { timeout: 90000 }, function (err, stdout, stderr) {
      if (err) {
        const msg = (stderr && stderr.trim()) || err.message || "unknown error";
        return reject(new Error(msg));
      }
      const lines = stdout
        .trim()
        .split("\n")
        .filter(function (l) {
          return l.trim();
        });
      const tracks = lines
        .map(function (l) {
          try {
            const info = JSON.parse(l);
            return {
              url: info.webpage_url || info.url,
              title: info.title || "Unknown",
            };
          } catch (_) {
            return null;
          }
        })
        .filter(Boolean);
      resolve(tracks);
    });
  });
}

app.get("/", function (req, res) {
  res.send("running");
});

app.post("/", async function (req, res) {
  const url = req.body && req.body.url;
  if (!url) return res.status(400).json({ error: "no url" });

  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return res.status(400).json({ error: "YouTube not supported" });
  }

  try {
    const isPlaylist =
      url.includes("/sets/") || url.includes("playlist");

    if (isPlaylist) {
      const tracks = await getPlaylistUrls(url);
      return res.json({ playlist: tracks, status: "playlist" });
    }

    const audioUrl = await runYtDlp(url);
    return res.json({ url: audioUrl, status: "stream" });
  } catch (e) {
    console.error("yt-dlp error for", url, "->", e.message);
    return res.status(500).json({ error: e.message });
  }
});

ensureYtDlp()
  .then(function () {
    app.listen(process.env.PORT || 3000, function () {
      console.log("running on port", process.env.PORT || 3000);
    });
  })
  .catch(function (e) {
    console.error("startup failed:", e.message);
    process.exit(1);
  });
