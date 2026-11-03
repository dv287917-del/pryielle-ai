// MSG ke SAME users/{uid} doc se account status (approval / ban). Koi naya collection nahi.
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../firebase";

export const OWNER_EMAIL = "workwithpryielle@gmail.com";

export type MsgUser = {
  uid: string;
  displayName?: string;
  username?: string;
  avatar?: string | null;
  banned?: boolean;
  banReason?: string;
  approval?: "pending" | "approved" | "rejected";
  rejectReason?: string;
  pro?: boolean;
  role?: string;
};

export type Account =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "error"; message: string }
  | { state: "ready"; me: MsgUser; owner: boolean };

export const isOwner = (u: User) => u.email === OWNER_EMAIL && u.emailVerified;

export function useAccount(user: User, attempt = 0): Account {
  const [acc, setAcc] = useState<Account>({ state: "loading" });

  useEffect(() => {
    setAcc({ state: "loading" });
    return onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        if (!snap.exists()) return setAcc({ state: "missing" });
        setAcc({ state: "ready", me: snap.data() as MsgUser, owner: isOwner(user) });
      },
      (e) => setAcc({ state: "error", message: e.message }),
    );
  }, [user, attempt]);

  return acc;
}
