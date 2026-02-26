import { NextResponse } from "next/server";
import db from "@/lib/db";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = "eventease-secret-key-123";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const user: any = db.prepare("SELECT * FROM users WHERE email = ? AND password = ?").get(email, password);
  
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET);
  
  const cookieStore = await cookies();
  cookieStore.set("token", token, { 
    httpOnly: true, 
    secure: true, 
    sameSite: "none",
    path: "/"
  });

  return NextResponse.json({ id: user.id, email: user.email, role: user.role, name: user.name });
}
