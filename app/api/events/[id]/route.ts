import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(id);
  return NextResponse.json(event);
}
