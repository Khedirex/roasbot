import bcrypt from "bcryptjs";

export function hashPassword(plain: string) {
  // salt=10 é suficiente aqui
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}
