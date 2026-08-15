import { NextResponse } from "next/server";
import { githubAuthorizeRedirect } from "@/lib/oauth";

export async function GET(): Promise<Response> {
  const url = await githubAuthorizeRedirect();
  return NextResponse.redirect(url);
}
