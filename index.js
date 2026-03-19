function runYtDlp(url) {
  return new Promise((resolve, reject) => {
    execFile(ytDlpPath, [
      url,
      "-j",              // dump JSON info instead
      "--no-playlist",
    ],
      { timeout: 30000 },
      (err, stdout, stderr) => {
        console.log("STDERR:", stderr?.substring(0, 500));
        if (err) return reject(new Error(stderr || err.message));
        try {
          const info = JSON.parse(stdout);
          // Find best audio format with a direct URL
          const formats = (info.formats || [])
            .filter(f => f.url && f.acodec !== "none")
            .sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0));
          
          console.log("Formats found:", formats.length);
          if (formats.length > 0) {
            console.log("Best format:", formats[0].ext, formats[0].abr);
            return resolve(formats[0].url);
          }
          
          // Fallback to direct url
          if (info.url) return resolve(info.url);
          
          return reject(new Error("no playable url in formats"));
        } catch (e) {
          return reject(new Error("JSON parse failed: " + stdout.substring(0, 200)));
        }
      }
    );
  });
}
