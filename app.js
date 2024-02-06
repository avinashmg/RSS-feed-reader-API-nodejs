// app.js

const express = require("express");
const sqlite3 = require("sqlite3");
const bodyParser = require("body-parser");
const Parser = require("rss-parser"); // Install this package using npm

const rssParser = new Parser();

const app = express();
const db = new sqlite3.Database("feeds.db");

app.use(bodyParser.json());

// Create the 'entries' table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY,
    feedurl TEXT,
    title TEXT,
    link TEXT UNIQUE,
    published TEXT
  )
`);

// Add new RSS URL
app.post("/add-feed", async (req, res) => {
  try {
    const { url } = req.body;
    const feed = await rssParser.parseURL(url);

    // Insert feed entries into the database
    feed.items.forEach((item) => {
      const { title, link, pubDate } = item;
      db.run(
        "INSERT INTO entries (title, link, published, feedurl) VALUES (?, ?, ?, ?)",
        [title, link, pubDate, url]
      );
    });

    res.status(201).json({ message: "Feed added successfully" });
  } catch (error) {
    console.error("Error adding feed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Fetch all feed updates
app.get("/feeds", (req, res) => {
  db.all("SELECT * FROM entries", (err, rows) => {
    if (err) {
      console.error("Error fetching feed updates:", err);
      res.status(500).json({ error: "Internal server error" });
    } else {
      res.json(rows);
    }
  });
});

// Fetch updates for a specific URL
app.get("/feeds/:url", (req, res) => {
  const { url } = req.params;
  db.all("SELECT * FROM entries WHERE link = ?", [url], (err, rows) => {
    if (err) {
      console.error("Error fetching feed updates:", err);
      res.status(500).json({ error: "Internal server error" });
    } else {
      res.json(rows);
    }
  });
});

setInterval(() => {
  //update the urls
  db.all("SELECT DISTINCT feedurl FROM entries", (err, rows) => {
    if (err) {
      console.error("Error getting feedurls:", err);
      res.status(500).json({ error: "Internal server error" });
    } else {
      rows.forEach(async (row) => {
        console.log("Updating:", row.feedurl);

        const feed = await rssParser.parseURL(row.feedurl);

        // Insert feed entries into the database
        feed.items.forEach((item) => {
          const { title, link, pubDate } = item;
          db.run(
            `INSERT INTO entries (feedurl, title, link, published)
           SELECT ?, ?, ?, ?
           WHERE NOT EXISTS (SELECT 1 FROM entries WHERE link = ?)`,
            [row.feedurl, title, link, pubDate, link]
          );
        });
      });
    }
  });
}, 1000 * 60 * 60); // update every hour

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
