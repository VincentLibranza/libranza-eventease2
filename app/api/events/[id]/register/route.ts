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

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    db.prepare("INSERT INTO registrations (user_id, event_id, registered_at) VALUES (?, ?, ?)").run(
      user.id,
      id,
      new Date().toISOString()
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Already registered" }, { status: 400 });
  }
}
