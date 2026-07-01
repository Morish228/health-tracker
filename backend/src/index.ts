import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/database'
import authRoutes from './routes/auth.routes';
import appointmentRoutes from './routes/appointment.routes';
import doctorRoutes from './routes/doctor.routes';
import adherenceRoutes from './routes/adherence.routes';

// Load environment variables
dotenv.config();
console.log(process.env.MONGODB_URI)

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Health Companion API',
    version: '1.0.0',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/adherence', adherenceRoutes);

// Connect to database and start server
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
