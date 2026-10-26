import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api-error";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "E-posta adresi veya şifre hatalı." },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          error:
            "Hesabınız devre dışı bırakılmıştır. Lütfen sistem yöneticisi ile iletişime geçiniz.",
        },
        { status: 403 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "E-posta adresi veya şifre hatalı." },
        { status: 401 }
      );
    }

    const token = await createSessionToken(user.id, user.role);
    await setSessionCookie(token);

    await prisma.auditLog.create({
      data: {
        action: "USER_LOGIN",
        entityType: "User",
        entityId: user.id,
        userId: user.id,
        summary: `${user.name} (${user.email}) sisteme giriş yaptı.`,
      },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
