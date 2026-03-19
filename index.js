const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("running"));

app.post("/", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "no url" });
  try {
    const cobaltRes = await fetch("https://api.cobalt.tools/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: JSON.stringify({ url, downloadMode: "audio", audioFormat: "mp3" }),
    });
    const data = await cobaltRes.json();
    console.log("Cobalt response:", data);
    if (data.url || data.status === "stream" || data.status === "tunnel") {
      return res.json({ url: data.url, status: "stream" });
    }
    return res.status(500).json({ error: data.error ?? "no url returned", raw: data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("running"));
