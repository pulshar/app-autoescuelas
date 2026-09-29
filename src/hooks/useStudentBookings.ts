import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.ts';
import type { Booking, AppSettings } from '../types.ts';

export function useStudentBookings(userId?: string) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [bRes, sRes] = await Promise.all([
        api.getBookings({ student_id: userId }),
        api.getSettings(),
      ]);
      setBookings(bRes.bookings);
      setSettings(sRes.settings);
    } catch (err: any) {
      console.error('Error fetching student bookings:', err);
      setError(err.message || 'Error al cargar las clases.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const cancelBooking = async (bookingId: string, reason?: string) => {
    const res = await api.cancelBooking(bookingId, reason);
    await fetchBookings();
    return res;
  };

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const isUpcoming = (b: Booking) => {
    if (b.status !== 'Reservada') return false;
    if (b.date < todayStr) return false;
    if (b.date === todayStr && b.end_time <= currentTime) return false;
    return true;
  };

  const upcomingBookings = bookings
    .filter(isUpcoming)
    .sort((a, b) => (a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date)));

  const historyBookings = bookings.filter((b) => !isUpcoming(b));

  const canCancel = (booking: Booking): { allowed: boolean; hoursRemaining: number } => {
    if (!settings) return { allowed: true, hoursRemaining: 99 };
    const [year, month, day] = booking.date.split('-').map(Number);
    const [hour, min] = booking.start_time.split(':').map(Number);
    const bookingDate = new Date(year, month - 1, day, hour, min);
    const diffHours = (bookingDate.getTime() - now.getTime()) / (1000 * 3600);
    return {
      allowed: diffHours >= settings.min_cancellation_hours,
      hoursRemaining: Math.max(0, Math.round(diffHours)),
    };
  };

  return {
    bookings,
    upcomingBookings,
    historyBookings,
    settings,
    loading,
    error,
    refresh: fetchBookings,
    cancelBooking,
    canCancel,
  };
}
