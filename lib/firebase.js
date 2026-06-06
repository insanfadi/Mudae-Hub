import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCo1dUS9-x8NL_olJ9ubQa4Em_Hk3BB49w",
  authDomain: "mudae-hub-7dc72.firebaseapp.com",
  projectId: "mudae-hub-7dc72",
  storageBucket: "mudae-hub-7dc72.firebasestorage.app",
  messagingSenderId: "645017163463",
  appId: "1:645017163463:web:f73dc3f293b9d12ac5d0e2"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
