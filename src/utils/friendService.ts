import {
  db,
  auth,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  handleFirestoreError,
  OperationType
} from "../firebase";
import { UserProfile } from "./userProfileService";

export interface Friendship {
  id: string;
  users: string[]; // [uidA, uidB]
  senderId: string;
  senderName: string;
  senderAvatar: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar: string;
  status: "pending" | "accepted" | "blocked";
  initiatorId: string;
  blockedBy?: string;
  createdAt: number;
  updatedAt: number;
}

export interface GameInvite {
  id: string;
  fromId: string;
  fromName: string;
  fromAvatar: string;
  toId: string;
  toName: string;
  roomCode: string;
  status: "pending" | "accepted" | "declined" | "expired";
  createdAt: number;
  expiresAt: number;
}

export interface FriendUser {
  uid: string;
  displayName: string;
  avatar: string;
  rating: number;
  title: string;
  league: string;
  totalWins: number;
  lastSeen?: number;
  presence?: "online" | "in_game" | "offline";
  activeRoomCode?: string | null;
  friendshipStatus?: "none" | "pending_sent" | "pending_received" | "friends" | "blocked";
  friendshipId?: string;
}

export function getFriendshipId(uid1: string, uid2: string): string {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

export function isUserOnline(lastSeen?: number): boolean {
  if (!lastSeen) return false;
  // If active in the last 2 minutes
  return Date.now() - lastSeen < 2 * 60 * 1000;
}

/**
 * Searches for registered players by display name or exact UID.
 */
export async function searchPlayers(
  searchTerm: string,
  currentUid: string,
  existingFriendships: Friendship[] = []
): Promise<FriendUser[]> {
  const term = searchTerm.trim().toLowerCase();
  if (!term || term.length < 1) return [];

  const path = "users";
  try {
    const usersCol = collection(db, path);
    const snap = await getDocs(usersCol);
    const results: FriendUser[] = [];

    snap.forEach((d) => {
      const u = d.data() as UserProfile & { presence?: "online" | "in_game" | "offline"; activeRoomCode?: string | null };
      if (u.uid === currentUid) return; // Skip self

      const nameMatch = (u.displayName || "").toLowerCase().includes(term);
      const uidMatch = u.uid.toLowerCase() === term || u.uid.toLowerCase().startsWith(term);
      const emailMatch = (u.email || "").toLowerCase().includes(term);

      if (nameMatch || uidMatch || emailMatch) {
        // Determine relationship status with current user
        const fId = getFriendshipId(currentUid, u.uid);
        const friendship = existingFriendships.find((f) => f.id === fId);

        let friendshipStatus: FriendUser["friendshipStatus"] = "none";
        if (friendship) {
          if (friendship.status === "accepted") {
            friendshipStatus = "friends";
          } else if (friendship.status === "blocked") {
            friendshipStatus = "blocked";
          } else if (friendship.status === "pending") {
            friendshipStatus = friendship.senderId === currentUid ? "pending_sent" : "pending_received";
          }
        }

        results.push({
          uid: u.uid,
          displayName: u.displayName || "Scholar Player",
          avatar: u.selectedAvatar || "🎓",
          rating: u.rating || 1200,
          title: u.selectedTitle || u.title || "Novice Speller",
          league: u.league || "Bronze League",
          totalWins: u.totalWins || 0,
          lastSeen: u.lastLoginAt || 0,
          presence: u.presence || (isUserOnline(u.lastLoginAt) ? "online" : "offline"),
          activeRoomCode: u.activeRoomCode || null,
          friendshipStatus,
          friendshipId: friendship?.id
        });
      }
    });

    return results.slice(0, 20); // Limit to top 20 matches
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Sends a friend request to a target user.
 */
export async function sendFriendRequest(
  sender: { uid: string; displayName: string; avatar: string },
  receiver: { uid: string; displayName: string; avatar: string }
): Promise<Friendship> {
  if (sender.uid === receiver.uid) {
    throw new Error("You cannot send a friend request to yourself.");
  }

  const friendshipId = getFriendshipId(sender.uid, receiver.uid);
  const path = `friendships/${friendshipId}`;

  try {
    const docRef = doc(db, "friendships", friendshipId);
    const existingSnap = await getDoc(docRef);

    if (existingSnap.exists()) {
      const existing = existingSnap.data() as Friendship;
      if (existing.status === "accepted") {
        throw new Error("You are already friends with this player.");
      }
      if (existing.status === "blocked") {
        throw new Error("Unable to send request to this user.");
      }
      if (existing.status === "pending") {
        if (existing.senderId === sender.uid) {
          throw new Error("Friend request is already pending.");
        } else {
          // Both sent request to each other -> automatically accept!
          const acceptedFriendship: Friendship = {
            ...existing,
            status: "accepted",
            updatedAt: Date.now()
          };
          await setDoc(docRef, acceptedFriendship, { merge: true });
          return acceptedFriendship;
        }
      }
    }

    const newFriendship: Friendship = {
      id: friendshipId,
      users: [sender.uid, receiver.uid],
      senderId: sender.uid,
      senderName: sender.displayName,
      senderAvatar: sender.avatar,
      receiverId: receiver.uid,
      receiverName: receiver.displayName,
      receiverAvatar: receiver.avatar,
      status: "pending",
      initiatorId: sender.uid,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await setDoc(docRef, newFriendship);
    return newFriendship;
  } catch (error: any) {
    if (error.message && !error.message.startsWith("{")) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Accepts an incoming friend request.
 */
export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const path = `friendships/${friendshipId}`;
  try {
    const docRef = doc(db, "friendships", friendshipId);
    await updateDoc(docRef, {
      status: "accepted",
      updatedAt: Date.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Rejects or cancels a friend request / removes a friendship.
 */
export async function removeOrRejectFriendship(friendshipId: string): Promise<void> {
  const path = `friendships/${friendshipId}`;
  try {
    const docRef = doc(db, "friendships", friendshipId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Blocks a user.
 */
export async function blockUser(
  currentUid: string,
  targetUser: { uid: string; displayName: string; avatar: string },
  currentUserName: string = "Player",
  currentUserAvatar: string = "🎓"
): Promise<void> {
  const friendshipId = getFriendshipId(currentUid, targetUser.uid);
  const path = `friendships/${friendshipId}`;

  try {
    const docRef = doc(db, "friendships", friendshipId);
    const blockedFriendship: Friendship = {
      id: friendshipId,
      users: [currentUid, targetUser.uid],
      senderId: currentUid,
      senderName: currentUserName,
      senderAvatar: currentUserAvatar,
      receiverId: targetUser.uid,
      receiverName: targetUser.displayName,
      receiverAvatar: targetUser.avatar,
      status: "blocked",
      initiatorId: currentUid,
      blockedBy: currentUid,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await setDoc(docRef, blockedFriendship, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Unblocks a user.
 */
export async function unblockUser(friendshipId: string): Promise<void> {
  const path = `friendships/${friendshipId}`;
  try {
    const docRef = doc(db, "friendships", friendshipId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Subscribes to real-time friendships and pending requests for the current user.
 */
export function subscribeToFriendships(
  currentUid: string,
  onUpdate: (friendships: Friendship[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!currentUid) {
    onUpdate([]);
    return () => {};
  }

  const path = "friendships";
  const q = query(collection(db, path), where("users", "array-contains", currentUid));

  return onSnapshot(
    q,
    (snapshot) => {
      const friendships: Friendship[] = [];
      snapshot.forEach((docSnap) => {
        friendships.push(docSnap.data() as Friendship);
      });
      onUpdate(friendships);
    },
    (error) => {
      console.warn("Friendships listener error:", error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

/**
 * Sends a direct in-game multiplayer invite to a friend.
 */
export async function sendGameInvite(
  fromUser: { uid: string; displayName: string; avatar: string },
  toUser: { uid: string; displayName: string },
  roomCode: string
): Promise<GameInvite> {
  const inviteId = `${fromUser.uid}_${toUser.uid}_${Date.now()}`;
  const path = `game_invites/${inviteId}`;

  const invite: GameInvite = {
    id: inviteId,
    fromId: fromUser.uid,
    fromName: fromUser.displayName,
    fromAvatar: fromUser.avatar,
    toId: toUser.uid,
    toName: toUser.displayName,
    roomCode: roomCode.toUpperCase(),
    status: "pending",
    createdAt: Date.now(),
    expiresAt: Date.now() + 3 * 60 * 1000 // 3 minutes expiration
  };

  try {
    const docRef = doc(db, "game_invites", inviteId);
    await setDoc(docRef, invite);
    return invite;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Accepts or declines an in-game match invite.
 */
export async function respondToGameInvite(
  inviteId: string,
  accept: boolean
): Promise<void> {
  const path = `game_invites/${inviteId}`;
  try {
    const docRef = doc(db, "game_invites", inviteId);
    await updateDoc(docRef, {
      status: accept ? "accepted" : "declined"
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Subscribes to real-time incoming game invites for the current user.
 */
export function subscribeToIncomingGameInvites(
  currentUid: string,
  onUpdate: (invites: GameInvite[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!currentUid) {
    onUpdate([]);
    return () => {};
  }

  const path = "game_invites";
  const q = query(
    collection(db, path),
    where("toId", "==", currentUid),
    where("status", "==", "pending")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const now = Date.now();
      const invites: GameInvite[] = [];
      snapshot.forEach((docSnap) => {
        const inv = docSnap.data() as GameInvite;
        if (inv.expiresAt > now) {
          invites.push(inv);
        }
      });
      onUpdate(invites);
    },
    (error) => {
      console.warn("Incoming invites listener error:", error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

/**
 * Updates user online presence / heartbeat in Firestore.
 */
export async function updateUserPresence(
  uid: string,
  presence: "online" | "in_game" | "offline",
  activeRoomCode: string | null = null
): Promise<void> {
  if (!uid) return;
  const path = `users/${uid}`;
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      lastLoginAt: Date.now(),
      presence,
      activeRoomCode
    });
  } catch {
    // Gracefully ignore presence update error if user doc is initializing
  }
}
