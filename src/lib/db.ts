import { PrismaClient } from "../generated/prisma";

export const prisma = new PrismaClient();

export async function connectDB() {
  try {
    await prisma.$connect();
    console.log("Database connected");
  } catch (error) {
    console.error("Database connection failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}
