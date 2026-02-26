import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = process.env.VERCEL === '1';
// On Vercel, the API is in /api, so we go up one level for the DB if not in /tmp
const dbPath = isVercel ? "/tmp/eventease.db" : path.join(__dirname, "..", "eventease.db");
const db = new Database(dbPath);

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    location TEXT,
    capacity INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    department TEXT,
    status TEXT DEFAULT 'registered',
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events (id)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER,
    event_id INTEGER,
    attended_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant_id) REFERENCES participants (id),
    FOREIGN KEY (event_id) REFERENCES events (id)
  );
`);

const app = express();

async function startServer() {
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/events", (req, res) => {
    const events = db.prepare("SELECT * FROM events ORDER BY date DESC").all();
    res.json(events);
  });

  app.post("/api/events", (req, res) => {
    const { title, description, date, location, capacity } = req.body;
    const info = db.prepare(
      "INSERT INTO events (title, description, date, location, capacity) VALUES (?, ?, ?, ?, ?)"
    ).run(title, description, date, location, capacity);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/events/:id", (req, res) => {
    const event = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id) as any;
    const participants = db.prepare("SELECT * FROM participants WHERE event_id = ?").all(req.params.id);
    res.json({ ...event, participants });
  });

  app.post("/api/register", (req, res) => {
    const { event_id, name, email, department } = req.body;
    try {
      const info = db.prepare(
        "INSERT INTO participants (event_id, name, email, department) VALUES (?, ?, ?, ?)"
      ).run(event_id, name, email, department);
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/attendance", (req, res) => {
    const { participant_id, event_id } = req.body;
    const existing = db.prepare("SELECT id FROM attendance WHERE participant_id = ? AND event_id = ?").get(participant_id, event_id);
    if (existing) {
      return res.status(400).json({ error: "Already checked in" });
    }
    const info = db.prepare(
      "INSERT INTO attendance (participant_id, event_id) VALUES (?, ?)"
    ).run(participant_id, event_id);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/participants", (req, res) => {
    const participants = db.prepare(`
      SELECT p.*, e.title as event_title 
      FROM participants p 
      JOIN events e ON p.event_id = e.id 
      ORDER BY p.registered_at DESC
    `).all();
    res.json(participants);
  });

  app.delete("/api/events/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM attendance WHERE event_id = ?").run(req.params.id);
      db.prepare("DELETE FROM participants WHERE event_id = ?").run(req.params.id);
      db.prepare("DELETE FROM events WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  app.get("/api/attendance/:eventId", (req, res) => {
    const attendance = db.prepare(`
      SELECT p.name, p.email, p.department, a.attended_at 
      FROM attendance a 
      JOIN participants p ON a.participant_id = p.id 
      WHERE a.event_id = ?
    `).all(req.params.eventId);
    res.json(attendance);
  });

  app.get("/api/stats", (req, res) => {
    const totalEvents = (db.prepare("SELECT COUNT(*) as count FROM events").get() as any).count;
    const totalParticipants = (db.prepare("SELECT COUNT(*) as count FROM participants").get() as any).count;
    const totalAttendance = (db.prepare("SELECT COUNT(*) as count FROM attendance").get() as any).count;
    
    const departmentStats = db.prepare(`
      SELECT department, COUNT(*) as count 
      FROM participants 
      GROUP BY department 
      ORDER BY count DESC
    `).all();

    const eventStats = db.prepare(`
      SELECT e.title, e.date, COUNT(p.id) as registrations, COUNT(a.id) as attendance
      FROM events e
      LEFT JOIN participants p ON e.id = p.event_id
      LEFT JOIN attendance a ON p.id = a.participant_id AND e.id = a.event_id
      GROUP BY e.id
      ORDER BY e.date ASC
    `).all();

    res.json({
      totalEvents,
      totalParticipants,
      totalAttendance,
      departmentStats,
      eventStats
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && !isVercel) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Fallback to index.html for SPA in dev
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else if (!isVercel) {
    // Production serving (only when NOT on Vercel, e.g. local production test)
    const distPath = path.join(__dirname, "..", "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  // Vercel handles the listening, but we need it for local dev
  if (!isVercel) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
