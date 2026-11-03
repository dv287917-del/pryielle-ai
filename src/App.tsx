import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "./firebase";
import { useAccount } from "./lib/account";
import { SignIn } from "./components/SignIn";
import { Home } from "./components/Home";
import { Gate } from "./components/Gate";
import { Burst } from "./components/art";
import { UpdateGate } from "./components/UpdateModal";

const logout = () => void signOut(auth);

function Loading() {
  return (
    <main className="boot">
      <Burst className="burst-spin" size={56} />
    </main>
  );
}

function Signed({ user }: { user: User }) {
  const [attempt, setAttempt] = useState(0);
  const acc = useAccount(user, attempt);

  if (acc.state === "loading") return <Loading />;
  if (acc.state === "error") return <Gate kind="error" detail={acc.message} onRetry={() => setAttempt((n) => n + 1)} onLogout={logout} />;
  if (acc.state === "missing") return <Gate kind="missing" onLogout={logout} />;

  const { me, owner } = acc;
  if (me.banned && !owner) return <Gate kind="banned" detail={me.banReason} onLogout={logout} />;
  if (me.approval === "pending" && !owner) return <Gate kind="pending" onLogout={logout} />;
  if (me.approval === "rejected" && !owner) return <Gate kind="rejected" detail={me.rejectReason} onLogout={logout} />;
  return (
    <>
      <Home user={user} me={me} />
      <UpdateGate />
    </>
  );
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setReady(true);
      }),
    [],
  );

  if (!ready) return <Loading />;
  return user ? <Signed user={user} /> : <SignIn />;
}
