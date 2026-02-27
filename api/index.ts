import express from "express";
import { createServer as createViteServer } from "vite";
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

if (dbUrl && dbUrl.startsWith('eyJ')) {
  console.error("ERROR: TURSO_DATABASE_URL contains a JWT token. Swapping to local fallback.");
  dbUrl = undefined;
}

const finalUrl = dbUrl || `file:${path.join(__dirname, "..", "eventease.db")}`;

const db = createClient({
  url: finalUrl,
  authToken: dbToken,
});

// Initialize Database with Users table
async function initDb() {
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
      FOREIGN KEY (user_id) REFERENCES users (id)
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

  try {
    await db.execute("ALTER TABLE events ADD COLUMN user_id INTEGER REFERENCES users(id)");
  } catch (e) {}
}

initDb().catch(console.error);

const app = express();

// Middleware to protect routes
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

async function startServer() {
  app.use(express.json());

  // AUTH ROUTES
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
      if (error.message?.includes("UNIQUE constraint failed")) {
        return res.status(400).json({ error: "Email already exists" });
      }
      res.status(500).json({ error: "Signup failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const result = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
      const user = result.rows[0] as any;
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET);
      res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // PROTECTED ROUTES (Require Login)
  app.get("/api/events", authenticateToken, async (req: any, res) => {
    const result = await db.execute({
      sql: "SELECT * FROM events WHERE user_id = ? ORDER BY date DESC",
      args: [req.user.id]
    });
    res.json(result.rows);
  });

  app.post("/api/events", authenticateToken, async (req: any, res) => {
    const { title, description, date, location, capacity } = req.body;
    const result = await db.execute({
      sql: "INSERT INTO events (user_id, title, description, date, location, capacity) VALUES (?, ?, ?, ?, ?, ?)",
      args: [req.user.id, title, description, date, location, capacity]
    });
    res.json({ id: Number(result.lastInsertRowid) });
  });

  // ... (Other routes like /api/register remain public, but /api/stats and /api/participants are protected)
}
// ... rest of server setup