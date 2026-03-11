import bcrypt from "bcrypt";

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10; // recommended cost factor
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  return hashedPassword;
}

// You might also want to add a password comparison function:
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
