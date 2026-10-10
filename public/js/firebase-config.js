// College OS — Firebase Auth & Firestore Client Integration

let firebaseConfig = null;
let firebaseApp = null;
let firebaseAuth = null;
let firestoreDb = null;

// Initialize Firebase SDK dynamically
async function initializeFirebase() {
  try {
    const res = await fetch('/api/config/firebase');
    const config = await res.json();
    if (config.apiKey && typeof firebase !== 'undefined') {
      firebaseConfig = config;
      firebaseApp = firebase.initializeApp(firebaseConfig);
      firebaseAuth = firebase.auth();
      firestoreDb = firebase.firestore();
      console.log('[Firebase] Initialized successfully with project:', firebaseConfig.projectId);
      window.firebaseConfig = firebaseConfig;
    }
  } catch (e) {
    console.warn('[Firebase] Initialization notice:', e.message);
  }
}

// Call init immediately
initializeFirebase();

const FirebaseSync = {
  isAvailable() {
    return !!(firebaseAuth && firestoreDb);
  },

  async syncUserData(userId, data) {
    if (!this.isAvailable() || !userId) return;
    try {
      await firestoreDb.collection('students').doc(userId).set({
        ...data,
        lastSyncedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log('[Firebase Firestore] User data synced to cloud.');
    } catch (err) {
      console.warn('[Firebase Firestore] Sync warning:', err.message);
    }
  },

  async loginWithGoogle() {
    if (!this.isAvailable()) throw new Error('Firebase Auth not available');
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await firebaseAuth.signInWithPopup(provider);
    return result.user;
  }
};

window.firebaseConfig = firebaseConfig;
window.FirebaseSync = FirebaseSync;
