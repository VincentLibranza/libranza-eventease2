import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = process.env.VERCEL === '1';

// Database Configuration
let dbUrl = process.env.TURSO_DATABASE_URL;
const dbToken = process.env.TURSO_AUTH_TOKEN;

// Safety Check: If URL starts with 'eyJ', it's actually a token. Swapped!
if (dbUrl && dbUrl.startsWith('eyJ')) {
  console.error("ERROR: TURSO_DATABASE_URL contains a JWT token. Swapping to local fallback.");
  dbUrl = undefined;
}

const finalUrl = dbUrl || `file:${path.join(__dirname, "..", "eventease.db")}`;

const db = createClient({
  url: finalUrl,
  authToken: dbToken,
});

// Initialize Database
async function initDb() {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      location TEXT,
      capacity INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      department TEXT,
      status TEXT DEFAULT 'registered',
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events (id)
    );`,
    `CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id INTEGER,
      event_id INTEGER,
      attended_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (participant_id) REFERENCES participants (id),
      FOREIGN KEY (event_id) REFERENCES events (id)
    );`
  ], "write");
}

initDb().catch(console.error);

const app = express();

async function startServer() {
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/events", async (req, res) => {
    const result = await db.execute("SELECT * FROM events ORDER BY date DESC");
    res.json(result.rows);
  });

  app.post("/api/events", async (req, res) => {
    const { title, description, date, location, capacity } = req.body;
    const result = await db.execute({
      sql: "INSERT INTO events (title, description, date, location, capacity) VALUES (?, ?, ?, ?, ?)",
      args: [title, description, date, location, capacity]
    });
    res.json({ id: Number(result.lastInsertRowid) });
  });

  app.get("/api/events/:id", async (req, res) => {
    const eventResult = await db.execute({
      sql: "SELECT * FROM events WHERE id = ?",
      args: [req.params.id]
    });
    const participantsResult = await db.execute({
      sql: "SELECT * FROM participants WHERE event_id = ?",
      args: [req.params.id]
    });
    res.json({ ...eventResult.rows[0], participants: participantsResult.rows });
  });

  app.post("/api/register", async (req, res) => {
    const { event_id, name, email, department } = req.body;
    try {
      const result = await db.execute({
        sql: "INSERT INTO participants (event_id, name, email, department) VALUES (?, ?, ?, ?)",
        args: [event_id, name, email, department]
      });
      res.json({ id: Number(result.lastInsertRowid) });
    } catch (error) {
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/attendance", async (req, res) => {
    const { participant_id, event_id } = req.body;
    const existingResult = await db.execute({
      sql: "SELECT id FROM attendance WHERE participant_id = ? AND event_id = ?",
      args: [participant_id, event_id]
    });
    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: "Already checked in" });
    }
    const result = await db.execute({
      sql: "INSERT INTO attendance (participant_id, event_id) VALUES (?, ?)",
      args: [participant_id, event_id]
    });
    res.json({ id: Number(result.lastInsertRowid) });
  });

  app.get("/api/participants", async (req, res) => {
    const result = await db.execute(`
      SELECT p.*, e.title as event_title,
             CASE WHEN a.id IS NOT NULL THEN 'attended' ELSE 'registered' END as status
      FROM participants p 
      JOIN events e ON p.event_id = e.id 
      LEFT JOIN attendance a ON p.id = a.participant_id AND p.event_id = a.event_id
      ORDER BY p.registered_at DESC
    `);
    res.json(result.rows);
  });

  app.delete("/api/events/:id", async (req, res) => {
    try {
      await db.batch([
        { sql: "DELETE FROM attendance WHERE event_id = ?", args: [req.params.id] },
        { sql: "DELETE FROM participants WHERE event_id = ?", args: [req.params.id] },
        { sql: "DELETE FROM events WHERE id = ?", args: [req.params.id] }
      ], "write");
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  app.get("/api/attendance/:eventId", async (req, res) => {
    const result = await db.execute({
      sql: `
        SELECT p.name, p.email, p.department, a.attended_at 
        FROM attendance a 
        JOIN participants p ON a.participant_id = p.id 
        WHERE a.event_id = ?
      `,
      args: [req.params.eventId]
    });
    res.json(result.rows);
  });

  app.get("/api/stats", async (req, res) => {
    const totalEventsRes = await db.execute("SELECT COUNT(*) as count FROM events");
    const totalParticipantsRes = await db.execute("SELECT COUNT(*) as count FROM participants");
    const totalAttendanceRes = await db.execute("SELECT COUNT(*) as count FROM attendance");
    
    const departmentStatsRes = await db.execute(`
      SELECT department, COUNT(*) as count 
      FROM participants 
      GROUP BY department 
      ORDER BY count DESC
    `);

    const eventStatsRes = await db.execute(`
      SELECT e.title, e.date, COUNT(p.id) as registrations, COUNT(a.id) as attendance
      FROM events e
      LEFT JOIN participants p ON e.id = p.event_id
      LEFT JOIN attendance a ON p.id = a.participant_id AND e.id = a.event_id
      GROUP BY e.id
      ORDER BY e.date ASC
    `);

    res.json({
      totalEvents: Number(totalEventsRes.rows[0].count),
      totalParticipants: Number(totalParticipantsRes.rows[0].count),
      totalAttendance: Number(totalAttendanceRes.rows[0].count),
      departmentStats: departmentStatsRes.rows,
      eventStats: eventStatsRes.rows
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
        const templatePath = path.resolve(__dirname, '..', 'index.html');
        let template = fs.readFileSync(templatePath, 'utf-8');
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