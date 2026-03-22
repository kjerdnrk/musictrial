function runYtDlp(url) {
  return new Promise(function(resolve, reject) {
    execFile(ytDlpPath, [
      url,
      "-j",
      "--no-playlist",
      "--format", "http_aac/http_mp3/bestaudio[ext=mp3]/bestaudio", // prefer direct http not HLS
    ], { timeout: 60000 }, function(err, stdout, stderr) {
      console.log("stderr:", stderr && stderr.substring(0, 300));
      if (err) return reject(new Error(stderr || err.message));
      try {
        var info = JSON.parse(stdout);
        var formats = (info.formats || [])
          .filter(function(f) {
            // Exclude HLS/DASH streams, prefer direct http
            return f.url && f.acodec !== "none" &&
                   !f.url.includes(".m3u8") &&
                   !f.url.includes("/playlist/") &&
                   (f.protocol === "https" || f.protocol === "http");
          })
          .sort(function(a, b) { return (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0); });

        console.log("Non-HLS formats:", formats.length);
        if (formats.length > 0) return resolve(formats[0].url);

        // Fallback — try progressive download URL
        if (info.url && !info.url.includes(".m3u8")) return resolve(info.url);

        reject(new Error("only HLS available for this track"));
      } catch(e) {
        reject(new Error("parse error: " + stdout.substring(0, 300)));
      }
    });
  });
}
