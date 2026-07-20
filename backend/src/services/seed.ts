/**
 * Seed service — demo hospitals, doctors (each with a login account), availability slots,
 * and an admin user. Idempotent: safe to run repeatedly (upserts by natural keys).
 *
 * Goals 38-39. Even though real doctors can self-register, seeding gives an instantly
 * bookable app for demos.
 */
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Doctor } from '../models/Doctor';
import { Hospital } from '../models/Hospital';
import { AvailabilitySlot } from '../models/AvailabilitySlot';

const HOSPITALS = [
  { name: 'City General Hospital', address: '12 MG Road, Bengaluru' },
  { name: 'Sunrise Multispeciality', address: '45 Park Street, Kolkata' },
];

// password is the same for all demo doctors for convenience: "doctor123"
const DOCTORS = [
  { email: 'dr.rao@demo.com', name: 'Dr. Anil Rao', specialization: 'Cardiology', qualifications: 'MD, DM Cardiology' },
  { email: 'dr.mehta@demo.com', name: 'Dr. Sana Mehta', specialization: 'Dermatology', qualifications: 'MBBS, MD' },
  { email: 'dr.iyer@demo.com', name: 'Dr. Karthik Iyer', specialization: 'General Medicine', qualifications: 'MBBS' },
  { email: 'dr.khan@demo.com', name: 'Dr. Farah Khan', specialization: 'Pediatrics', qualifications: 'MBBS, DCH' },
];

const SLOT_TIMES = [
  { startTime: '09:00', endTime: '09:30' },
  { startTime: '10:00', endTime: '10:30' },
  { startTime: '11:00', endTime: '11:30' },
  { startTime: '15:00', endTime: '15:30' },
];

/** Upsert a user by email; returns the user. */
const upsertUser = async (email: string, password: string, role: 'doctor' | 'admin') => {
  const existing = await User.findOne({ email });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(password, 10);
  return User.create({ email, passwordHash, role, isVerified: true });
};

export const seedHospitals = async () => {
  const results = [];
  for (const h of HOSPITALS) {
    const hospital = await Hospital.findOneAndUpdate(
      { name: h.name },
      { $setOnInsert: h },
      { new: true, upsert: true }
    );
    results.push(hospital);
  }
  return results;
};

export const seedDoctors = async () => {
  const hospitals = await Hospital.find();
  const results = [];
  for (let i = 0; i < DOCTORS.length; i++) {
    const d = DOCTORS[i];
    const user = await upsertUser(d.email, 'doctor123', 'doctor');
    const hospital = hospitals[i % hospitals.length];

    const doctor = await Doctor.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        name: d.name,
        specialization: d.specialization,
        qualifications: d.qualifications,
        hospitalId: hospital?._id,
        contact: d.email,
      },
      { new: true, upsert: true }
    );
    results.push(doctor);
  }
  return results;
};

/** Seed AVAILABLE slots for each doctor for the next `days` days. */
export const seedSlots = async (days = 7) => {
  const doctors = await Doctor.find();
  let created = 0;

  for (const doctor of doctors) {
    for (let dayOffset = 1; dayOffset <= days; dayOffset++) {
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() + dayOffset);

      for (const t of SLOT_TIMES) {
        // Upsert on the unique compound index (doctorId + date + startTime).
        const result = await AvailabilitySlot.updateOne(
          { doctorId: doctor._id, date, startTime: t.startTime },
          { $setOnInsert: { doctorId: doctor._id, date, startTime: t.startTime, endTime: t.endTime, status: 'AVAILABLE' } },
          { upsert: true }
        );
        if (result.upsertedCount) created++;
      }
    }
  }
  return created;
};

export const seedAdmin = async () => {
  const email = process.env.ADMIN_EMAIL || 'admin@demo.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  return upsertUser(email, password, 'admin');
};

/** Run the whole seed and return a summary. */
export const seedAll = async () => {
  const admin = await seedAdmin();
  const hospitals = await seedHospitals();
  const doctors = await seedDoctors();
  const slotsCreated = await seedSlots();
  return {
    admin: admin.email,
    hospitals: hospitals.length,
    doctors: doctors.length,
    slotsCreated,
  };
};
