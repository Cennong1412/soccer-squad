// Firebase 초기화 (뉴스 "저장" 기능의 기기 간 동기화용).
// type="module" 스크립트라 이 파일 안의 함수/변수는 전역에서 안 보이므로
// window.SoccerAuth / window.SoccerNews 에 필요한 것만 노출한다.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, deleteDoc, collection, getDocs, query, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBcZ8LVVbJQ5TRdJ6BahRwPdNyKCPLTwmA",
  authDomain: "world-soccer-squad.firebaseapp.com",
  projectId: "world-soccer-squad",
  storageBucket: "world-soccer-squad.firebasestorage.app",
  messagingSenderId: "222997450627",
  appId: "1:222997450627:web:beea270ef3137a34cc70b6",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

window.SoccerAuth = {
  currentUser: undefined, // undefined: 아직 판별 전, null: 로그아웃 상태, 객체: 로그인 상태
  _listeners: [],
  onChange(cb) {
    this._listeners.push(cb);
    if (this.currentUser !== undefined) cb(this.currentUser);
  },
  async signIn() {
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error("로그인 실패", e);
      alert("로그인에 실패했습니다: " + e.message);
    }
  },
  signOut() {
    return signOut(auth);
  },
};

onAuthStateChanged(auth, (user) => {
  window.SoccerAuth.currentUser = user;
  window.SoccerAuth._listeners.forEach((cb) => cb(user));
});

window.SoccerNews = {
  async saveArticle(article) {
    const user = window.SoccerAuth.currentUser;
    if (!user) throw new Error("not-logged-in");
    await setDoc(doc(db, "users", user.uid, "saved", article.id), {
      ...article,
      savedAt: serverTimestamp(),
    });
  },
  async unsaveArticle(articleId) {
    const user = window.SoccerAuth.currentUser;
    if (!user) throw new Error("not-logged-in");
    await deleteDoc(doc(db, "users", user.uid, "saved", articleId));
  },
  async getSavedArticles() {
    const user = window.SoccerAuth.currentUser;
    if (!user) return [];
    const q = query(collection(db, "users", user.uid, "saved"), orderBy("savedAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data());
  },
};
