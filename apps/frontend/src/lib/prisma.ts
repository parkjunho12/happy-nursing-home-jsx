// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

// Next.js dev에서 HMR로 PrismaClient가 여러 번 생성되는 문제 방지
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // log: ["query", "info", "warn", "error"], // 필요하면 켜기
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
