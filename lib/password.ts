import "server-only";
import { genSaltSync, hashSync, compareSync } from "bcryptjs";
import bcrypt from "bcryptjs";

export function hashPassword(plain: string) {
  const salt = genSaltSync(10);
  return hashSync(plain, salt);
}

export function verifyPassword(plain: string, hash: string) {
  return compareSync(plain, hash);
}