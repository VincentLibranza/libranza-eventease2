import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = process.env.VERCEL === '1';
const JWT_SECRET = process.env.JWT_SECRET || 'eventease-secret-key-123';

// Database Configuration
let dbUrl = process.env.TURSO_DATABASE_URL;
const dbToken = process.env.TURSO_AUTH_TOKEN;

const localDbPath = isVercel ? "/tmp/eventease.db" : path.join(__dirname, "..", "eventease.db");
const finalUrl = dbUrl || `file:${localDbPath}`;

const db = createClient({
  url: finalUrl,
  authToken: dbToken,
});

// Initialize Database
async function initDb() {
  try {
    // Enable foreign keys
    await db.execute("PRAGMA foreign_keys = ON");

    await db.batch([
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        date TEXT NOT NULL,
        location TEXT,
        capacity INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );`,
      `CREATE TABLE IF NOT EXISTS participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        department TEXT,
        status TEXT DEFAULT 'registered',
        registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
      );`,
      `CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        participant_id INTEGER,
        event_id INTEGER,
        attended_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (participant_id) REFERENCES participants (id) ON DELETE CASCADE,
        FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
      );`
    ], "write");

    // Migration: Add user_id to events if it doesn't exist
    try {
      await db.execute("ALTER TABLE events ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
    } catch (e) {
      // Column might already exist
    }
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

initDb().catch(console.error);

const app = express();
app.use(express.json());

// Middleware to verify JWT
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: "Forbidden" });
    req.user = user;
    next();
  });
};

// Auth Routes
app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.execute({
      sql: "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      args: [name, email, hashedPassword]
    });
    const userId = Number(result.lastInsertRowid);
    const token = jwt.sign({ id: userId, email, name }, JWT_SECRET);
    res.json({ token, user: { id: userId, name, email } });
  } catch (error: any) {
    console.error("Signup error:", error);
    if (error.message?.includes("UNIQUE constraint failed")) {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: `Signup failed: ${error.message || 'Unknown error'}` });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.execute({
      sql: "SELECT * FROM users WHERE email = ?",
      args: [email]
    });
    const user = result.rows[0] as any;
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: `Login failed: ${error.message || 'Unknown error'}` });
  }
});

// API Routes (Protected)
app.get("/api/events", authenticateToken, async (req: any, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT * FROM events WHERE user_id = ? ORDER BY date DESC",
      args: [req.user.id]
    });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

app.post("/api/events", authenticateToken, async (req: any, res) => {
  const { title, description, date, location, capacity } = req.body;
  try {
    const result = await db.execute({
      sql: "INSERT INTO events (user_id, title, description, date, location, capacity) VALUES (?, ?, ?, ?, ?, ?)",
      args: [req.user.id, title, description, date, location, capacity]
    });
    res.json({ id: Number(result.lastInsertRowid) });
  } catch (error) {
    res.status(500).json({ error: "Failed to create event" });
  }
});

app.delete("/api/events/:id", authenticateToken, async (req: any, res) => {
  try {
    const event = await db.execute({
      sql: "SELECT id FROM events WHERE id = ? AND user_id = ?",
      args: [req.params.id, req.user.id]
    });
    if (event.rows.length === 0) return res.status(403).json({ error: "Unauthorized" });

    await db.execute({
      sql: "DELETE FROM events WHERE id = ?",
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete event" });
  }
});

app.get("/api/stats", authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  try {
    const totalEventsRes = await db.execute({
      sql: "SELECT COUNT(*) as count FROM events WHERE user_id = ?",
      args: [userId]
    });
    const totalParticipantsRes = await db.execute({
      sql: "SELECT COUNT(*) as count FROM participants p JOIN events e ON p.event_id = e.id WHERE e.user_id = ?",
      args: [userId]
    });
    const totalAttendanceRes = await db.execute({
      sql: "SELECT COUNT(*) as count FROM attendance a JOIN events e ON a.event_id = e.id WHERE e.user_id = ?",
      args: [userId]
    });
    
    const departmentStatsRes = await db.execute({
      sql: `
        SELECT department, COUNT(*) as count 
        FROM participants p
        JOIN events e ON p.event_id = e.id
        WHERE e.user_id = ?
        GROUP BY department 
        ORDER BY count DESC
      `,
      args: [userId]
    });

    const eventStatsRes = await db.execute({
      sql: `
        SELECT e.title, e.date, COUNT(p.id) as registrations, COUNT(a.id) as attendance
        FROM events e
        LEFT JOIN participants p ON e.id = p.event_id
        LEFT JOIN attendance a ON p.id = a.participant_id AND e.id = a.event_id
        WHERE e.user_id = ?
        GROUP BY e.id
        ORDER BY e.date ASC
      `,
      args: [userId]
    });

    res.json({
      totalEvents: Number(totalEventsRes.rows[0].count),
      totalParticipants: Number(totalParticipantsRes.rows[0].count),
      totalAttendance: Number(totalAttendanceRes.rows[0].count),
      departmentStats: departmentStatsRes.rows,
      eventStats: eventStatsRes.rows
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production" && !isVercel) {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
  
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
  const distPath = path.join(__dirname, "..", "dist");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

// Start server locally
if (!isVercel) {
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;