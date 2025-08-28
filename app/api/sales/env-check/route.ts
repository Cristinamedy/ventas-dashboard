import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasService: !!process.env.SUPABASE_SERVICE_ROLE,
    hasAdmin: !!process.env.ADMIN_TOKEN,
  });
}
