// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// هنا نستخدم نفس التكوين العام الذي استخدمناه سابقًا
const firebaseConfig = {
    apiKey: "AIzaSyAaP_skZH15nFpkUh4l8xW3JWALQyG0E0Y",
    authDomain: "hejazi-ssd.firebaseapp.com",
    projectId: "hejazi-ssd",
    storageBucket: "hejazi-ssd.firebasestorage.app",
    messagingSenderId: "880985922577",
    appId: "1:880985922577:web:ec6db20848d692195625b0"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };