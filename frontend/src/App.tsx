import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import DoctorRegister from './pages/DoctorRegister';
import Dashboard from './pages/Dashboard';
import Vitals from './pages/Vitals';
import Medications from './pages/Medications';
import Appointments from './pages/Appointments';
import Reports from './pages/Reports';
import Scanner from './pages/Scanner';
import Assistant from './pages/Assistant';
import Caregiver from './pages/Caregiver';
import Emergency from './pages/Emergency';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import DoctorAppointments from './pages/DoctorAppointments';
import DoctorSlots from './pages/DoctorSlots';
import DoctorProfile from './pages/DoctorProfile';
import Admin from './pages/Admin';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/doctor/register" element={<DoctorRegister />} />

          {/* Protected app shell */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              {/* Patient area (doctors get bounced to /doctor) */}
              <Route element={<RoleRoute />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/assistant" element={<Assistant />} />
                <Route path="/vitals" element={<Vitals />} />
                <Route path="/medications" element={<Medications />} />
                <Route path="/appointments" element={<Appointments />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/scanner" element={<Scanner />} />
                <Route path="/caregivers" element={<Caregiver />} />
                <Route path="/emergency" element={<Emergency />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin" element={<Admin />} />
              </Route>

              {/* Doctor area (patients get bounced to /) */}
              <Route element={<RoleRoute requireDoctor />}>
                <Route path="/doctor" element={<DoctorAppointments />} />
                <Route path="/doctor/slots" element={<DoctorSlots />} />
                <Route path="/doctor/profile" element={<DoctorProfile />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
