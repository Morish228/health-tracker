import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

export type Role = 'patient' | 'caregiver' | 'admin' | 'doctor';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: Role;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, jwtSecret) as { userId: string; role?: Role };

    req.userId = decoded.userId;
    // Prefer the role embedded in the token; fall back to a DB lookup if absent
    // (keeps older tokens issued before roles were added working).
    req.userRole = decoded.role;
    if (!req.userRole) {
      const user = await User.findById(decoded.userId).select('role');
      req.userRole = (user?.role as Role) || 'patient';
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

/**
 * Role guard. Use AFTER `authenticate`, e.g.
 *   router.post('/slots', authenticate, requireRole('doctor'), createSlot)
 * Passing multiple roles allows any of them.
 */
export const requireRole = (...allowed: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !allowed.includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires role: ${allowed.join(' or ')}`,
      });
    }
    next();
  };
};
