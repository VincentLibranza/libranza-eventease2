import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req: Request) {
  const { email, password, name, department } = await req.json();
  try {
    const result = db.prepare("INSERT INTO users (email, password, name, department) VALUES (?, ?, ?, ?)").run(email, password, name, department);
    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (err) {
    return NextResponse.json({ error: "Email already exists" }, { status: 400 });
  }
}
