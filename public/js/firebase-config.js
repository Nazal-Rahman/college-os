// College OS — Firebase Auth & Firestore Client Integration

let firebaseConfig = null;
let firebaseApp = null;
let firebaseAuth = null;
let firestoreDb = null;
let _initPromise = null;

async function initializeFirebase() {
  if (_initPromise) return _initPromise;
  
  _initPromise = (async () => {
    try {
      const res = await fetch('/api/config/firebase');
      const config = await res.json();
      if (!config || !config.apiKey) {
        console.warn('[Firebase] Config not found on server.');
        return false;
      }
      if (typeof firebase !== 'undefined') {
        firebaseConfig = config;
        if (!firebase.apps.length) {
          firebaseApp = firebase.initializeApp(firebaseConfig);
        } else {
          firebaseApp = firebase.app();
        }
        firebaseAuth = firebase.auth();
        firestoreDb = firebase.firestore();
        console.log('[Firebase] Initialized with project:', firebaseConfig.projectId);
        window.firebaseConfig = firebaseConfig;
        return true;
      }
    } catch (e) {
      console.warn('[Firebase] Initialization notice:', e.message);
    }
    return false;
  })();

  return _initPromise;
}

// Start initialization immediately
initializeFirebase();

const FirebaseSync = {
  lastSyncStatus: {
    success: null,
    timestamp: null,
    error: null
  },

  async init() {
    return initializeFirebase();
  },

  isAvailable() {
    return !!(firebaseAuth && firestoreDb);
  },

  getStatus() {
    return {
      available: this.isAvailable(),
      projectId: firebaseConfig ? firebaseConfig.projectId : null,
      ...this.lastSyncStatus
    };
  },

  // Strip all undefined properties to prevent Firestore "Function set() called with invalid data" errors
  cleanPayload(obj) {
    try {
      return JSON.parse(JSON.stringify(obj, (key, value) => {
        if (value === undefined) return null;
        return value;
      }));
    } catch(e) {
      return obj;
    }
  },

  async syncUserData(userId, data) {
    await this.init();
    if (!this.isAvailable()) return false;

    // Use Firebase Auth UID as primary doc ID (ensures Flutter mobile app & Web share exact same doc)
    const primaryUid = (firebaseAuth && firebaseAuth.currentUser && firebaseAuth.currentUser.uid)
      ? firebaseAuth.currentUser.uid
      : (data?.firebaseUid || userId);

    if (!primaryUid) return false;
    
    try {
      const cleanData = this.cleanPayload(data);
      cleanData.lastSyncedAt = firebase.firestore.FieldValue.serverTimestamp();
      cleanData.uid = primaryUid;
      cleanData.firebaseUid = primaryUid;
      if (firebaseAuth && firebaseAuth.currentUser && firebaseAuth.currentUser.email) {
        cleanData.email = cleanData.email || firebaseAuth.currentUser.email;
      }

      await firestoreDb.collection('students').doc(primaryUid).set(cleanData, { merge: true });
      
      this.lastSyncStatus = {
        success: true,
        timestamp: new Date(),
        error: null
      };
      console.log('[Firebase Firestore] User data synced for cross-platform linking (UID: ' + primaryUid + ').');
      window.dispatchEvent(new CustomEvent('cloud-sync-status', { detail: this.lastSyncStatus }));
      return true;
    } catch (err) {
      this.lastSyncStatus = {
        success: false,
        timestamp: new Date(),
        error: err.message
      };
      console.warn('[Firebase Firestore] Sync notice:', err.message);
      window.dispatchEvent(new CustomEvent('cloud-sync-status', { detail: this.lastSyncStatus }));
      return false;
    }
  },

  async loadUserData(userId) {
    await this.init();
    if (!this.isAvailable()) return null;

    // Standard cross-platform lookup by Firebase Auth UID first
    const primaryUid = (firebaseAuth && firebaseAuth.currentUser && firebaseAuth.currentUser.uid)
      ? firebaseAuth.currentUser.uid
      : userId;

    try {
      if (primaryUid) {
        const doc = await firestoreDb.collection('students').doc(primaryUid).get();
        if (doc.exists) {
          console.log('[Firebase Firestore] Cloud data restored (UID: ' + primaryUid + ').');
          return doc.data();
        }
      }
      if (userId && userId !== primaryUid) {
        const doc2 = await firestoreDb.collection('students').doc(userId).get();
        if (doc2.exists) {
          console.log('[Firebase Firestore] Cloud data restored from fallback ID: ' + userId);
          return doc2.data();
        }
      }
      return null;
    } catch (err) {
      console.warn('[Firebase Firestore] Load notice:', err.message);
      return null;
    }
  },

  async loginWithGoogle() {
    await this.init();
    if (!this.isAvailable()) throw new Error('Firebase Auth not available. Please check network connection.');
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await firebaseAuth.signInWithPopup(provider);
    return result.user;
  }
};

window.firebaseConfig = firebaseConfig;
window.FirebaseSync = FirebaseSync;
