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
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stats = {
    totalEvents: db.prepare("SELECT COUNT(*) as count FROM events").get() as any,
    totalUsers: db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'user'").get() as any,
    totalRegistrations: db.prepare("SELECT COUNT(*) as count FROM registrations").get() as any,
    attendanceRate: db.prepare(`
      SELECT 
        CAST(SUM(attended) AS FLOAT) / COUNT(*) * 100 as rate 
      FROM registrations
    `).get() as any,
    eventsByCategory: db.prepare(`
      SELECT category as name, COUNT(*) as value FROM events GROUP BY category
    `).all(),
    registrationsByEvent: db.prepare(`
      SELECT e.title as name, COUNT(r.id) as value 
      FROM events e 
      LEFT JOIN registrations r ON e.id = r.event_id 
      GROUP BY e.id
    `).all()
  };
  
  return NextResponse.json(stats);
}
