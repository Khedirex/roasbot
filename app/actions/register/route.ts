import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").toLowerCase().trim();
    const password = String(form.get("password") ?? "");

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ ok: false, error: "Senha muito curta." }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ ok: false, error: "E-mail já cadastrado." }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { email, password: hash, name },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("register POST error:", err);
    return NextResponse.json({ ok: false, error: "Falha no servidor." }, { status: 500 });
  }
}

// garantir Node (bcrypt não roda em edge)
export const runtime = "nodejs";
