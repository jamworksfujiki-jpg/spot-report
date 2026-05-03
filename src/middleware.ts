import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const PUBLIC_PATHS = ["/login", "/api/login", "/api/logout"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get("auth_session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete("auth_session");
    return res;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|css|js|map)).*)",
  ],
};
