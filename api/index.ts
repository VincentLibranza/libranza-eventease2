import express from "express";
import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = process.env.VERCEL === '1';
const JWT_SECRET = process.env.JWT_SECRET || 'eventease-secret-key-123';

// Database Configuration
let dbUrl = process.env.TURSO_DATABASE_URL;
const dbToken = process.env.TURSO_AUTH_TOKEN;

// Safety Check
if (dbUrl && dbUrl.startsWith('eyJ')) {
  dbUrl = undefined;
}

const localDbPath = isVercel ? "/tmp/eventease.db" : path.join(__dirname, "..", "eventease.db");
const finalUrl = dbUrl || `file:${localDbPath}`;

let db: any;
try {
  db = createClient({
    url: finalUrl,
    authToken: dbToken,
  });
} catch (e) {
  console.error("Failed to create database client:", e);
}

// Initialize Database
let isDbInitialized = false;
async function ensureDb() {
  if (isDbInitialized) return;
  if (!db) throw new Error("Database client not initialized");
  
  console.log("Initializing database...");
  try {
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

    try {
      await db.execute("ALTER TABLE events ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
    } catch (e) {}
    
    isDbInitialized = true;
    console.log("Database initialized.");
  } catch (error: any) {
    console.error("DB Init Error:", error);
    throw new Error(`DB Init Failed: ${error.message}`);
  }
}

const app = express();
app.use(express.json());

// Middleware to ensure DB is ready
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api') && req.path !== '/api/health') {
    try {
      await ensureDb();
      next();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  } else {
    next();
  }
});

// Middleware to verify JWT and check if user exists in DB
const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, JWT_SECRET, async (err: any, decoded: any) => {
    if (err) return res.status(403).json({ error: "Forbidden" });
    
    try {
      // Verify user still exists in the database (handles stale sessions after DB resets)
      const result = await db.execute({
        sql: "SELECT id FROM users WHERE id = ?",
        args: [decoded.id]
      });
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: "User no longer exists. Please log in again." });
      }
      
      req.user = decoded;
      next();
    } catch (dbError) {
      console.error("Auth DB check error:", dbError);
      res.status(500).json({ error: "Internal server error during authentication" });
    }
  });
};

// Auth Routes
app.get("/api/health", async (req, res) => {
  try {
    await db.execute("SELECT 1");
    res.json({ status: "ok", database: "connected", isVercel });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

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
  console.log("Creating event for user:", req.user.id, { title, date });
  try {
    const result = await db.execute({
      sql: "INSERT INTO events (user_id, title, description, date, location, capacity) VALUES (?, ?, ?, ?, ?, ?)",
      args: [req.user.id, title, description, date, location, capacity]
    });
    console.log("Event created successfully, ID:", result.lastInsertRowid);
    res.json({ id: Number(result.lastInsertRowid) });
  } catch (error: any) {
    console.error("Failed to create event:", error);
    res.status(500).json({ error: `Failed to create event: ${error.message || 'Unknown error'}` });
  }
});

app.get("/api/events/:id", async (req, res) => {
  try {
    const eventResult = await db.execute({
      sql: "SELECT * FROM events WHERE id = ?",
      args: [req.params.id]
    });
    if (eventResult.rows.length === 0) return res.status(404).json({ error: "Event not found" });
    
    const participantsResult = await db.execute({
      sql: `
        SELECT p.id, p.event_id, p.name, p.email, p.department, p.registered_at,
               CASE WHEN a.id IS NOT NULL THEN 'attended' ELSE 'registered' END as status
        FROM participants p 
        LEFT JOIN attendance a ON p.id = a.participant_id AND p.event_id = a.event_id
        WHERE p.event_id = ?
      `,
      args: [req.params.id]
    });
    res.json({ ...eventResult.rows[0], participants: participantsResult.rows });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch event details" });
  }
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
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/attendance", async (req, res) => {
  const { participant_id, event_id } = req.body;
  
  if (!participant_id || !event_id) {
    return res.status(400).json({ error: "Missing participant_id or event_id" });
  }

  try {
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
    res.json({ id: Number(result.lastInsertRowid), success: true });
  } catch (error: any) {
    console.error("Attendance error:", error);
    res.status(500).json({ error: `Attendance check-in failed: ${error.message}` });
  }
});

app.get("/api/participants", authenticateToken, async (req: any, res) => {
  try {
    const result = await db.execute({
      sql: `
        SELECT p.id, p.event_id, p.name, p.email, p.department, p.registered_at, 
               e.title as event_title,
               CASE WHEN a.id IS NOT NULL THEN 'attended' ELSE 'registered' END as status
        FROM participants p 
        JOIN events e ON p.event_id = e.id 
        LEFT JOIN attendance a ON p.id = a.participant_id AND p.event_id = a.event_id
        WHERE e.user_id = ?
        ORDER BY p.registered_at DESC
      `,
      args: [req.user.id]
    });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch participants" });
  }
});

app.delete("/api/events/:id", authenticateToken, async (req: any, res) => {
  try {
    // Verify ownership
    const event = await db.execute({
      sql: "SELECT id FROM events WHERE id = ? AND user_id = ?",
      args: [req.params.id, req.user.id]
    });
    if (event.rows.length === 0) return res.status(403).json({ error: "Unauthorized" });

    // With ON DELETE CASCADE, we only need to delete the event
    await db.execute({
      sql: "DELETE FROM events WHERE id = ?",
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

app.get("/api/attendance/:eventId", async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch attendance" });
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
    console.error("Stats error:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

// Global Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Global error handler:", err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production" && !isVercel) {
  const { createServer: createViteServer } = await import("vite");
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
