import { NextResponse } from "next/server";
import db from "@/lib/db";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { GoogleGenAI } from "@google/genai";

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

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await req.json();
  const event: any = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
  const regs = db.prepare("SELECT COUNT(*) as count FROM registrations WHERE event_id = ?").get(eventId) as any;
  const deptStats = db.prepare(`
    SELECT u.department, COUNT(r.id) as count
    FROM registrations r
    JOIN users u ON r.user_id = u.id
    WHERE r.event_id = ?
    GROUP BY u.department
  `).all(eventId);
  
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const prompt = `
      Predict the attendance rate for an event with the following details:
      Title: ${event.title}
      Category: ${event.category}
      Capacity: ${event.capacity}
      Current Registrations: ${regs.count}
      Date: ${event.date}
      Location: ${event.location}
      Department Distribution: ${JSON.stringify(deptStats)}

      Return a JSON object with:
      - predicted_attendance_count (number)
      - confidence_score (0-1)
      - reasoning (string)
      - suggestions (array of strings to improve attendance)
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    return NextResponse.json(JSON.parse(response.text || "{}"));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "AI Prediction failed" }, { status: 500 });
  }
}
