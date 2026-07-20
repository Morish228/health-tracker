/**
 * CLI seed runner:  npm run seed
 * Connects to MongoDB, seeds demo data, prints a summary, and exits.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database';
import { seedAll } from '../services/seed';

dotenv.config();

const run = async () => {
  await connectDB();
  console.log('🌱 Seeding demo data...');
  const summary = await seedAll();
  console.log('✅ Seed complete:', summary);
  console.log('   Demo doctor login: dr.rao@demo.com / doctor123');
  console.log('   Demo admin login :', summary.admin, '/ admin123 (or ADMIN_PASSWORD)');
  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
