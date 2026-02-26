import { NextResponse } from "next/server";
import db from "@/lib/db";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = "eventease-secret-key-123";

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch (err) {
    return null;
  }
}

export async function GET() {
  const events = db.prepare(`
    SELECT e.*, 
    (SELECT COUNT(*) FROM registrations WHERE event_id = e.id) as registration_count
    FROM events e
  `).all();
  return NextResponse.json(events);
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, description, date, location, capacity, category } = await req.json();
  const result = db.prepare(`
    INSERT INTO events (title, description, date, location, capacity, category, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title, description, date, location, capacity, category, user.id);
  
  return NextResponse.json({ id: result.lastInsertRowid });
}
