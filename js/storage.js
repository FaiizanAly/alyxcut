// AlyxCut Local Storage Manager using IndexedDB
// Zero-cost, 100% private, client-side persistence for AlyxFai

const DB_NAME = 'alyxcut_db';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_SETTINGS = 'settings';

export const DEFAULT_SETTINGS = {
  captionLanguage: 'hinglish', // 'hinglish' (default) | 'hindi' | 'english'
  clipDuration: 'auto',        // 'auto' | 15 | 30 | 45 | 60 | custom
  customDuration: 30,
  clipCount: 'auto',           // 'auto' | 5 | 10 | 15 | custom
  customCount: 5,
  platform: 'reels',           // 'reels' | 'shorts'
  cropMode: 'blur',            // 'blur' | 'center' | 'fit'
  captionStyle: {
    fontSize: 28,
    fontFamily: 'Inter, sans-serif',
    textColor: '#FFFFFF',
    highlightColor: '#FFE600',
    bgColor: 'rgba(0, 0, 0, 0.75)',
    position: 'bottom',        // 'bottom' | 'center' | 'top'
    bold: true,
    wordHighlight: true,
    uppercase: true,
  },
  modelName: 'onnx-community/whisper-tiny',
  preferWebGPU: true,
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('IndexedDB failed to open, falling back to in-memory/localStorage');
      resolve(null);
    };
  });

  return dbPromise;
}

// ----------------- SETTINGS -----------------

export async function getSettings() {
  try {
    const db = await openDB();
    if (!db) {
      const local = localStorage.getItem('alyxcut_settings');
      return local ? { ...DEFAULT_SETTINGS, ...JSON.parse(local) } : { ...DEFAULT_SETTINGS };
    }

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.get('app_settings');

      req.onsuccess = () => {
        if (req.result && req.result.value) {
          resolve({ ...DEFAULT_SETTINGS, ...req.result.value });
        } else {
          resolve({ ...DEFAULT_SETTINGS });
        }
      };
      req.onerror = () => resolve({ ...DEFAULT_SETTINGS });
    });
  } catch (err) {
    console.error('Error fetching settings:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(newSettings) {
  try {
    const current = await getSettings();
    const updated = { ...current, ...newSettings };

    const db = await openDB();
    if (!db) {
      localStorage.setItem('alyxcut_settings', JSON.stringify(updated));
      return updated;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readwrite');
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.put({ key: 'app_settings', value: updated });

      req.onsuccess = () => {
        localStorage.setItem('alyxcut_settings', JSON.stringify(updated));
        resolve(updated);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error saving settings:', err);
    return newSettings;
  }
}

// ----------------- PROJECTS -----------------

export async function getAllProjects() {
  try {
    const db = await openDB();
    if (!db) return [];

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = req.result || [];
        // Sort descending by updated/created date
        list.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error('Error getting projects:', err);
    return [];
  }
}

export async function getProject(id) {
  try {
    const db = await openDB();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.error('Error getting project:', err);
    return null;
  }
}

export async function saveProject(project) {
  try {
    const db = await openDB();
    if (!db) return project;

    const data = {
      ...project,
      updatedAt: new Date().toISOString(),
      createdAt: project.createdAt || new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.put(data);

      req.onsuccess = () => resolve(data);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error saving project:', err);
    return project;
  }
}

export async function deleteProject(id) {
  try {
    const db = await openDB();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (err) {
    console.error('Error deleting project:', err);
    return false;
  }
}

export async function clearAllProjects() {
  try {
    const db = await openDB();
    if (!db) return true;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.clear();

      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (err) {
    console.error('Error clearing projects:', err);
    return false;
  }
}

// ----------------- STORAGE USAGE & DIAGNOSTICS -----------------

export async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      return {
        usageBytes: estimate.usage || 0,
        quotaBytes: estimate.quota || 0,
        usageMB: ((estimate.usage || 0) / (1024 * 1024)).toFixed(1),
        quotaMB: ((estimate.quota || 0) / (1024 * 1024)).toFixed(1),
      };
    } catch {
      // fallback
    }
  }
  return { usageBytes: 0, quotaBytes: 0, usageMB: '0', quotaMB: 'N/A' };
}

export default {
  getSettings,
  saveSettings,
  getAllProjects,
  getProject,
  saveProject,
  deleteProject,
  clearAllProjects,
  getStorageEstimate,
  DEFAULT_SETTINGS,
};
