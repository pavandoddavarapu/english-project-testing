import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

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

// Initialize Firebase Auth & Firestore
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { auth, db, provider };
