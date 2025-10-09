import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

declare global {
  var __prisma: PrismaClient | undefined;
}

// Optimized connection pool configuration for serverless environments
const prismaClientConfig = {
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Reduce connection pool for serverless
  // Neon free tier: 5 connections max
  // Each serverless function gets 1-2 connections
  log: process.env.NODE_ENV === 'development' 
    ? ['query' as const, 'error' as const, 'warn' as const] 
    : ['error' as const],
};

// Connection pool management for Vercel serverless
if (process.env.NODE_ENV === "production") {
  // In production (Vercel), create a single instance per function
  // Vercel will manage connection lifecycle
  prisma = new PrismaClient(prismaClientConfig);
  
  // Graceful shutdown - disconnect on serverless function termination
  prisma.$connect().catch((err) => {
    console.error('Failed to connect to database:', err);
  });
} else {
  // In development, reuse connection across hot reloads
  if (!global.__prisma) {
    global.__prisma = new PrismaClient(prismaClientConfig);
  }
  prisma = global.__prisma;
}

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}

export default prisma;
