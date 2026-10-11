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

    const email = (data?.email || (firebaseAuth && firebaseAuth.currentUser ? firebaseAuth.currentUser.email : '') || '').toLowerCase().trim();
    const primaryUid = (firebaseAuth && firebaseAuth.currentUser && firebaseAuth.currentUser.uid)
      ? firebaseAuth.currentUser.uid
      : (data?.firebaseUid || userId);

    if (!primaryUid && !email) return false;

    try {
      const cleanData = this.cleanPayload(data);
      cleanData.lastSyncedAt = firebase.firestore.FieldValue.serverTimestamp();
      cleanData.uid = primaryUid;
      cleanData.email = email;
      cleanData.userId = userId;

      // 1. Primary UID document (for Flutter & Firebase Auth)
      if (primaryUid) {
        await firestoreDb.collection('students').doc(primaryUid).set(cleanData, { merge: true });
      }

      // 2. Deterministic Email document (for multi-device sync with same email)
      if (email) {
        const emailDocId = 'email_' + btoa(email).replace(/[^a-zA-Z0-9]/g, '');
        await firestoreDb.collection('students').doc(emailDocId).set(cleanData, { merge: true });
      }

      this.lastSyncStatus = {
        success: true,
        timestamp: new Date(),
        error: null
      };
      console.log('[Firebase Firestore] User data synced for cross-platform linking.');
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

  async loadUserData(userId, userEmail) {
    await this.init();
    if (!this.isAvailable()) return null;

    const email = (userEmail || (firebaseAuth && firebaseAuth.currentUser ? firebaseAuth.currentUser.email : '') || '').toLowerCase().trim();
    const primaryUid = (firebaseAuth && firebaseAuth.currentUser && firebaseAuth.currentUser.uid)
      ? firebaseAuth.currentUser.uid
      : userId;

    try {
      // 1. Check primary UID doc
      if (primaryUid) {
        const doc = await firestoreDb.collection('students').doc(primaryUid).get();
        if (doc.exists && doc.data()) {
          console.log('[Firebase Firestore] Cloud data restored by UID:', primaryUid);
          return doc.data();
        }
      }

      // 2. Check deterministic email doc (restores data across different devices using same email!)
      if (email) {
        const emailDocId = 'email_' + btoa(email).replace(/[^a-zA-Z0-9]/g, '');
        const docEmail = await firestoreDb.collection('students').doc(emailDocId).get();
        if (docEmail.exists && docEmail.data()) {
          console.log('[Firebase Firestore] Cloud data restored by email doc:', emailDocId);
          return docEmail.data();
        }

        // 3. Query collection by email field
        const querySnap = await firestoreDb.collection('students').where('email', '==', email).limit(1).get();
        if (!querySnap.empty) {
          const docData = querySnap.docs[0].data();
          console.log('[Firebase Firestore] Cloud data restored by email query');
          return docData;
        }
      }

      // 4. Check fallback userId doc
      if (userId && userId !== primaryUid) {
        const docFallback = await firestoreDb.collection('students').doc(userId).get();
        if (docFallback.exists && docFallback.data()) {
          console.log('[Firebase Firestore] Cloud data restored by fallback ID:', userId);
          return docFallback.data();
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
