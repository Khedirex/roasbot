import "server-only";
import { genSaltSync, hashSync, compareSync } from "bcryptjs";
import bcrypt from "bcryptjs";

export function hashPassword(plain: string) {
  const salt = genSaltSync(10);
  return hashSync(plain, salt);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}