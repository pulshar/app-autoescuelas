import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.ts';
import type { AppSettings } from '../types.ts';

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getSettings();
      setSettings(res.settings);
    } catch (err: any) {
      setError(err.message || 'Error al obtener la configuración.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();

    const handleSettingsUpdated = (e: any) => {
      if (e?.detail) {
        setSettings((prev) => (prev ? { ...prev, ...e.detail } : e.detail));
      }
    };
    window.addEventListener('app-settings-updated', handleSettingsUpdated);
    return () => window.removeEventListener('app-settings-updated', handleSettingsUpdated);
  }, [fetchSettings]);

  const updateSettings = async (data: Partial<AppSettings>) => {
    const res = await api.updateSettings(data);
    setSettings(res.settings);
    window.dispatchEvent(new CustomEvent('app-settings-updated', { detail: res.settings }));
    return res.settings;
  };

  return {
    settings,
    loading,
    error,
    refresh: fetchSettings,
    updateSettings,
  };
}
