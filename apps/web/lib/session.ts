import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { webEnv } from "./env";

export type Session = {
  userId: string;
  login: string;
  githubUserId: string;
};

const COOKIE = "stackoperator_session";

function secretKey(): Uint8Array {
  return new TextEncoder().encode(webEnv().SESSION_SECRET);
}

export async function encryptSession(session: Session): Promise<string> {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function decryptSession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      typeof payload["userId"] !== "string" ||
      typeof payload["login"] !== "string" ||
      typeof payload["githubUserId"] !== "string"
    ) {
      return null;
    }
    return {
      userId: payload["userId"],
      login: payload["login"],
      githubUserId: payload["githubUserId"],
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) {
    return null;
  }
  return decryptSession(token);
}

export async function setSessionCookie(session: Session): Promise<void> {
  const jar = await cookies();
  const token = await encryptSession(session);
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
