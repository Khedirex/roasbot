// scripts/upsert-user.mjs
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const email = process.argv[2] || "marcelinow7@gmail.com";
const password = process.argv[3] || "Willian12@";
const name = process.argv[4] || "Willian";

async function main() {
  const hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: hash,
      role: "ADMIN", // você quer admin pra esse email
    },
    create: {
      name,
      email,
      password: hash,
      role: "ADMIN",
    },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  console.log("Upsert ok:", user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
