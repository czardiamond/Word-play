import React, { useState, useEffect } from "react";
import { Gamepad2, UserPlus, Check, X, Bell, Users, Sparkles } from "lucide-react";
import {
  GameInvite,
  Friendship,
  respondToGameInvite,
  acceptFriendRequest
} from "../utils/friendService";

interface FriendNotificationsToastProps {
  incomingInvites: GameInvite[];
  incomingRequests: Friendship[];
  onOpenFriendsModal: () => void;
  onJoinRoom: (roomCode: string) => void;
}

export default function FriendNotificationsToast({
  incomingInvites,
  incomingRequests,
  onOpenFriendsModal,
  onJoinRoom
}: FriendNotificationsToastProps) {
  const [dismissedInviteIds, setDismissedInviteIds] = useState<Set<string>>(new Set());
  const [dismissedRequestIds, setDismissedRequestIds] = useState<Set<string>>(new Set());
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Filter out dismissed notifications
  const activeInvites = incomingInvites.filter((inv) => !dismissedInviteIds.has(inv.id));
  const activeRequests = incomingRequests.filter((req) => !dismissedRequestIds.has(req.id));

  if (activeInvites.length === 0 && activeRequests.length === 0) {
    return null;
  }

  const handleAcceptInvite = async (invite: GameInvite) => {
    setAcceptingId(invite.id);
    try {
      await respondToGameInvite(invite.id, true);
      setDismissedInviteIds((prev) => new Set([...prev, invite.id]));
      onJoinRoom(invite.roomCode);
    } catch (err) {
      console.warn("Failed to accept game invite:", err);
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDeclineInvite = async (invite: GameInvite) => {
    try {
      await respondToGameInvite(invite.id, false);
      setDismissedInviteIds((prev) => new Set([...prev, invite.id]));
    } catch (err) {
      console.warn("Failed to decline game invite:", err);
    }
  };

  const handleAcceptFriend = async (request: Friendship) => {
    setAcceptingId(request.id);
    try {
      await acceptFriendRequest(request.id);
      setDismissedRequestIds((prev) => new Set([...prev, request.id]));
    } catch (err) {
      console.warn("Failed to accept friend request:", err);
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDismissRequest = (requestId: string) => {
    setDismissedRequestIds((prev) => new Set([...prev, requestId]));
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {/* Active Game Invites */}
      {activeInvites.map((invite) => (
        <div
          key={invite.id}
          className="pointer-events-auto bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border-2 border-indigo-500/60 flex flex-col gap-3 animate-in slide-in-from-bottom-5 duration-300 backdrop-blur-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 border border-indigo-400/40 flex items-center justify-center text-xl shadow-xs">
                  {invite.fromAvatar || "🎓"}
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                  <Gamepad2 className="w-2.5 h-2.5 text-white" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                    Game Invite
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <h4 className="font-bold text-xs text-white">
                  <span className="text-indigo-300">{invite.fromName}</span> invited you!
                </h4>
                <p className="text-[11px] text-slate-300 font-mono">
                  Room: #{invite.roomCode}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleDeclineInvite(invite)}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleAcceptInvite(invite)}
              disabled={acceptingId === invite.id}
              className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{acceptingId === invite.id ? "Joining..." : "Accept & Join"}</span>
            </button>
            <button
              type="button"
              onClick={() => handleDeclineInvite(invite)}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Decline
            </button>
          </div>
        </div>
      ))}

      {/* Active Friend Requests */}
      {activeRequests.map((req) => (
        <div
          key={req.id}
          className="pointer-events-auto bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-4 rounded-2xl shadow-xl border border-indigo-500/40 flex flex-col gap-3 animate-in slide-in-from-bottom-5 duration-300"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-xl shrink-0">
                {req.senderAvatar || "🎓"}
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Friend Request
                </span>
                <h4 className="font-bold text-xs">
                  <span className="text-indigo-600 dark:text-indigo-400">{req.senderName}</span> sent you a friend request!
                </h4>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleDismissRequest(req.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleAcceptFriend(req)}
              disabled={acceptingId === req.id}
              className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{acceptingId === req.id ? "Accepting..." : "Accept"}</span>
            </button>
            <button
              type="button"
              onClick={onOpenFriendsModal}
              className="py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
            >
              <Users className="w-3 h-3" />
              <span>View</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
