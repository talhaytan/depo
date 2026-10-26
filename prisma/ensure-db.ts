import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

const prisma = new PrismaClient();

async function ensureSeeded() {
  try {
    const userCount = await prisma.user.count();
    const productCount = await prisma.product.count();

    if (userCount === 0 || productCount === 0) {
      console.log("📦 Veritabanı boş tespit edildi, başlangıç verileri (66 fişek ve yönetici hesabı) yükleniyor...");
      execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
    } else {
      console.log(`✅ Veritabanı hazır (${productCount} ürün, ${userCount} kullanıcı).`);
    }
  } catch (err) {
    console.log("📦 Veritabanı hazırlanıyor ve tohumlanıyor...");
    execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
  } finally {
    await prisma.$disconnect();
  }
}

ensureSeeded();
