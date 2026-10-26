import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const SESSION_COOKIE_NAME = "depo_session";

function getJwtSecret(): Uint8Array {
  const secret =
    process.env.JWT_SECRET ||
    "depo-local-dev-secret-key-2026-secure-session-token-998877";
  return new TextEncoder().encode(secret);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "EMPLOYEE";
  isActive: boolean;
  permissions: {
    canManageProducts: boolean;
    canManageCategories: boolean;
    canManageSuppliers: boolean;
    canStockIn: boolean;
    canStockOut: boolean;
    canAdjustStock: boolean;
    canViewReports: boolean;
    canExportData: boolean;
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifySessionToken(
  token: string
): Promise<{ sub: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.sub || typeof payload.sub !== "string") return null;
    return { sub: payload.sub, role: String(payload.role || "EMPLOYEE") };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = await verifySessionToken(token);
    if (!payload) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) return null;

    const isAdmin = user.role === "ADMIN";
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: isAdmin ? "ADMIN" : "EMPLOYEE",
      isActive: user.isActive,
      permissions: {
        canManageProducts: isAdmin || user.canManageProducts,
        canManageCategories: isAdmin || user.canManageCategories,
        canManageSuppliers: isAdmin || user.canManageSuppliers,
        canStockIn: isAdmin || user.canStockIn,
        canStockOut: isAdmin || user.canStockOut,
        canAdjustStock: isAdmin || user.canAdjustStock,
        canViewReports: isAdmin || user.canViewReports,
        canExportData: isAdmin || user.canExportData,
      },
    };
  } catch {
    return null;
  }
}

export type PermissionKey = keyof SessionUser["permissions"];

export function hasPermission(
  user: SessionUser | null,
  permission?: PermissionKey | "ADMIN_ONLY"
): boolean {
  if (!user || !user.isActive) return false;
  if (user.role === "ADMIN") return true;
  if (!permission) return true;
  if (permission === "ADMIN_ONLY") return false;
  return Boolean(user.permissions[permission]);
}

export class AuthorizationError extends Error {
  status: number;
  constructor(message = "Bu işlem için yetkiniz bulunmamaktadır.", status = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

export async function requireUser(
  permission?: PermissionKey | "ADMIN_ONLY"
): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthorizationError("Oturum açmanız gerekmektedir.", 401);
  }
  if (!hasPermission(user, permission)) {
    throw new AuthorizationError("Bu işlem için yetkiniz bulunmamaktadır.", 403);
  }
  return user;
}
