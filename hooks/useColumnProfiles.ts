import { useState, useEffect, useCallback } from 'react';

export interface ColumnProfile {
  id: string;
  name: string;
  hiddenColumns: string[];
}

const STORAGE_KEY = 'crypto-terminal-column-profiles';
const ACTIVE_PROFILE_KEY = 'crypto-terminal-active-column-profile';

export function useColumnProfiles() {
  const [profiles, setProfiles] = useState<ColumnProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Load profiles from localStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const storedActive = localStorage.getItem(ACTIVE_PROFILE_KEY);
      
      if (stored) {
        const parsed = JSON.parse(stored);
        const profilesList = Array.isArray(parsed) ? parsed : [];
        setProfiles(profilesList);
        
        // Set active profile
        if (storedActive && profilesList.find((p: ColumnProfile) => p.id === storedActive)) {
          setActiveProfileId(storedActive);
        } else if (profilesList.length > 0) {
          setActiveProfileId(profilesList[0].id);
        }
      } else {
        // Create a default profile
        const defaultProfile: ColumnProfile = {
          id: 'default',
          name: 'Default',
          hiddenColumns: [],
        };
        setProfiles([defaultProfile]);
        setActiveProfileId('default');
        localStorage.setItem(STORAGE_KEY, JSON.stringify([defaultProfile]));
        localStorage.setItem(ACTIVE_PROFILE_KEY, 'default');
      }
    } catch (error) {
      console.error('Error loading column profiles:', error);
      const defaultProfile: ColumnProfile = {
        id: 'default',
        name: 'Default',
        hiddenColumns: [],
      };
      setProfiles([defaultProfile]);
      setActiveProfileId('default');
    }
  }, []);

  // Save profiles to localStorage whenever they change (debounced)
  useEffect(() => {
    if (!mounted || profiles.length === 0) return;
    
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
        if (activeProfileId) {
          localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfileId);
        }
      } catch (error) {
        console.error('Error saving column profiles:', error);
      }
    }, 150);
    
    return () => clearTimeout(timeoutId);
  }, [profiles, activeProfileId, mounted]);

  const createProfile = useCallback((name: string, hiddenColumns: string[] = []): string => {
    const newProfile: ColumnProfile = {
      id: `profile-${Date.now()}`,
      name,
      hiddenColumns: [...hiddenColumns],
    };
    setProfiles((prev) => [...prev, newProfile]);
    setActiveProfileId(newProfile.id);
    return newProfile.id;
  }, []);

  const deleteProfile = useCallback((id: string) => {
    setProfiles((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      // If deleting active profile, switch to first available
      if (id === activeProfileId && filtered.length > 0) {
        setActiveProfileId(filtered[0].id);
      } else if (filtered.length === 0) {
        // Create default if all deleted
        const defaultProfile: ColumnProfile = {
          id: 'default',
          name: 'Default',
          hiddenColumns: [],
        };
        setActiveProfileId('default');
        return [defaultProfile];
      }
      return filtered;
    });
  }, [activeProfileId]);

  const renameProfile = useCallback((id: string, newName: string) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: newName } : p))
    );
  }, []);

  const updateProfileColumns = useCallback((id: string, hiddenColumns: string[]) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, hiddenColumns: [...hiddenColumns] } : p))
    );
  }, []);

  const switchProfile = useCallback((id: string) => {
    if (profiles.find((p) => p.id === id)) {
      setActiveProfileId(id);
    }
  }, [profiles]);

  const getActiveProfile = useCallback((): ColumnProfile | null => {
    if (!activeProfileId) return null;
    return profiles.find((p) => p.id === activeProfileId) || null;
  }, [profiles, activeProfileId]);

  return {
    profiles,
    activeProfileId,
    mounted,
    createProfile,
    deleteProfile,
    renameProfile,
    updateProfileColumns,
    switchProfile,
    getActiveProfile,
  };
}

