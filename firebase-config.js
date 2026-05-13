import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-LXQhlPLmrzx_oOhWjo5skg6PnslE_m4",
  authDomain: "speak-up-76a89.firebaseapp.com",
  projectId: "speak-up-76a89",
  storageBucket: "speak-up-76a89.firebasestorage.app",
  messagingSenderId: "1019164172767",
  appId: "1:1019164172767:web:e8aa8fe95f5bd09c2c646a",
  measurementId: "G-8MS96L0WJV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
const auth = getAuth(app);

// Initialize Firestore with a STRICT cache limit (3 MB) to prevent browser bloat.
// The garbage collector will aggressively clean up old data if it hits this limit.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: 3145728 // 3 MB (default is 40 MB)
  })
});

const provider = new GoogleAuthProvider();

export { auth, db, provider };
