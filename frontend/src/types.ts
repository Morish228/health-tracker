// Shared types mirroring the backend API shapes.

export type Role = 'patient' | 'caregiver' | 'doctor' | 'admin';

export interface User {
  id: string;
  email: string;
  role: Role;
  firstName?: string;
  lastName?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Vitals — note the backend enum values are UPPERCASE.
export type VitalType =
  | 'BLOOD_PRESSURE_SYSTOLIC'
  | 'BLOOD_PRESSURE_DIASTOLIC'
  | 'BLOOD_SUGAR'
  | 'HEART_RATE'
  | 'SPO2'
  | 'WEIGHT'
  | 'TEMPERATURE'
  | 'RESPIRATORY_RATE';

export interface VitalLog {
  _id: string;
  patientId: string;
  type: VitalType;
  value: number;
  unit: string;
  recordedAt: string;
  note?: string;
}
