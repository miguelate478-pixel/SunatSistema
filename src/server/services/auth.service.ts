import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { userRepository } from "../repositories/user.repository";
import prisma from "@/lib/db/prisma";
import type { LoginInput, RegisterInput } from "@/lib/validators/auth";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is required");
  return secret;
}
const JWT_EXPIRES_IN = "7d";

export class AuthService {
  async login(input: LoginInput) {
    const { email, password } = input;

    const user = await userRepository.findByEmail(email);
    if (!user || !user.isActive) throw new Error("Credenciales inválidas");

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) throw new Error("Credenciales inválidas");

    const token = jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  }

  async register(input: RegisterInput) {
    const { email, password, nombre, companyId } = input;

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) throw new Error("El email ya está registrado");

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await userRepository.create({ email, password: hashedPassword, nombre });

    if (companyId) {
      const defaultRole = await prisma.role.findFirst({ where: { name: "ADMIN_EMPRESA" } });
      if (defaultRole) await userRepository.assignRole(user.id, companyId, defaultRole.id);
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  }

  async verifyToken(token: string) {
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as { userId: string; email: string };
      const user = await userRepository.findById(decoded.userId);
      if (!user || !user.isActive) throw new Error("Usuario no válido");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch {
      throw new Error("Token inválido");
    }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new Error("Usuario no encontrado");
    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) throw new Error("Contraseña actual incorrecta");
    const hashed = await bcrypt.hash(newPassword, 10);
    await userRepository.update(userId, { password: hashed });
    return { success: true };
  }

  async validateCredentials(email: string, password: string) {
    const user = await userRepository.findByEmail(email);
    if (!user || !user.isActive) return null;
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updatePassword(userId: string, newPassword: string) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userRepository.update(userId, { password: hashedPassword });
    return { success: true };
  }
}

export const authService = new AuthService();
