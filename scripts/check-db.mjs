#!/usr/bin/env node
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
config();

const prisma = new PrismaClient();

async function checkAndPushSchema() {
  try {
    console.log('🔍 Checking database connectivity...');
    
    // Test basic connectivity
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Check existing tables
    console.log('\n📊 Checking existing tables...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public'
      ORDER BY table_name;
    `;
    
    console.log('Existing tables:', tables);
    
    // Check if Session table exists
    const sessionTableExists = tables.some((t) => 
      t.table_name === 'Session' || t.table_name === 'session'
    );
    
    console.log(`\n🔎 Session table exists: ${sessionTableExists}`);
    
    if (!sessionTableExists) {
      console.log('\n⚠️  Session table missing! You need to run:');
      console.log('   npx prisma db push');
      console.log('\nThis will create all missing tables from your schema.');
    }
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkAndPushSchema();
