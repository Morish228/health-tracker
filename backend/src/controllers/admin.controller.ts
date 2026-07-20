import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { seedAll, seedSlots } from '../services/seed';

/** Goal 38-39 — admin triggers demo data seeding via API. */
export const runSeed = async (req: AuthRequest, res: Response) => {
  try {
    const summary = await seedAll();
    res.status(200).json({ success: true, message: 'Seed complete', data: summary });
  } catch (error: any) {
    console.error('Admin seed error:', error);
    res.status(500).json({ success: false, message: 'Seed failed', error: error.message });
  }
};

/** Goal 39 — admin tops up availability slots for the next N days. */
export const runSeedSlots = async (req: AuthRequest, res: Response) => {
  try {
    const days = Number(req.body?.days) || 7;
    const created = await seedSlots(days);
    res.status(200).json({ success: true, message: 'Slots seeded', data: { created, days } });
  } catch (error: any) {
    console.error('Admin seed slots error:', error);
    res.status(500).json({ success: false, message: 'Failed to seed slots', error: error.message });
  }
};
