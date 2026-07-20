import { Response } from 'express';
import { Notification } from '../models/Notification';
import { AuthRequest } from '../middlewares/auth';

/** List my notifications (newest first). Optional ?unread=true filter. */
export const getMyNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const filter: any = { userId: req.userId };
    if (req.query.unread === 'true') filter.read = false;

    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(100);
    const unreadCount = await Notification.countDocuments({ userId: req.userId, read: false });

    res.status(200).json({ success: true, unreadCount, data: notifications });
  } catch (error: any) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to load notifications', error: error.message });
  }
};

/** Mark one notification read. */
export const markRead = async (req: AuthRequest, res: Response) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.status(200).json({ success: true, data: notification });
  } catch (error: any) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, message: 'Failed to update notification', error: error.message });
  }
};

/** Mark all my notifications read. */
export const markAllRead = async (req: AuthRequest, res: Response) => {
  try {
    await Notification.updateMany({ userId: req.userId, read: false }, { read: true });
    res.status(200).json({ success: true, message: 'All notifications marked read' });
  } catch (error: any) {
    console.error('Mark all read error:', error);
    res.status(500).json({ success: false, message: 'Failed to update notifications', error: error.message });
  }
};
