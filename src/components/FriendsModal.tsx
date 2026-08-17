import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Search,
  Check,
  X,
  Shield,
  Sparkles,
  Swords,
  Copy,
  Clock,
  UserCheck,
  UserX,
  MoreVertical,
  Circle,
  Gamepad2,
  RefreshCw,
  Send
} from "lucide-react";
import {
  Friendship,
  GameInvite,
  FriendUser,
  searchPlayers,
  sendFriendRequest,
  acceptFriendRequest,
  removeOrRejectFriendship,
  blockUser,
  unblockUser,
  sendGameInvite,
  isUserOnline
} from "../utils/friendService";
import { getRankBadgeColor } from "../utils/ratingSystem";
import { createRoom } from "../utils/roomService";
import { Player } from "../types";
import { auth } from "../firebase";

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUid: string;
  currentUserName: string;
  currentUserAvatar: string;
  friendships: Friendship[];
  onStartOnlineGame?: (players: Player[], roomCode: string) => void;
  activeOnlineRoomCode?: string | null;
}

export default function FriendsModal({
  isOpen,
  onClose,
  currentUid,
  currentUserName,
  currentUserAvatar,
  friendships,
  onStartOnlineGame,
  activeOnlineRoomCode
}: FriendsModalProps) {
  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "add" | "blocked">("friends");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null);
  const [inviteSuccessId, setInviteSuccessId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [friendFilter, setFriendFilter] = useState("");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Split friendships into categories
  const acceptedFriendships = friendships.filter((f) => f.status === "accepted");
  const incomingRequests = friendships.filter(
    (f) => f.status === "pending" && f.receiverId === currentUid
  );
  const outgoingRequests = friendships.filter(
    (f) => f.status === "pending" && f.senderId === currentUid
  );
  const blockedList = friendships.filter(
    (f) => f.status === "blocked" && f.blockedBy === currentUid
  );

  // Search players effect
  useEffect(() => {
    if (activeTab !== "add" || !searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setActionError(null);
      try {
        const results = await searchPlayers(searchQuery, currentUid, friendships);
        setSearchResults(results);
      } catch (err: any) {
        console.warn("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab, currentUid, friendships]);

  const handleCopyMyCode = () => {
    navigator.clipboard.writeText(currentUid);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSendRequest = async (targetUser: FriendUser) => {
    setActionError(null);
    try {
      await sendFriendRequest(
        { uid: currentUid, displayName: currentUserName, avatar: currentUserAvatar },
        { uid: targetUser.uid, displayName: targetUser.displayName, avatar: targetUser.avatar }
      );
      // Re-trigger search to update state
      if (searchQuery) {
        const updated = await searchPlayers(searchQuery, currentUid, friendships);
        setSearchResults(updated);
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to send friend request.");
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    setActionError(null);
    try {
      await acceptFriendRequest(friendshipId);
    } catch (err: any) {
      setActionError(err.message || "Failed to accept request.");
    }
  };

  const handleRejectOrRemove = async (friendshipId: string) => {
    setActionError(null);
    setOpenDropdownId(null);
    try {
      await removeOrRejectFriendship(friendshipId);
    } catch (err: any) {
      setActionError(err.message || "Failed to update friendship.");
    }
  };

  const handleBlockUser = async (target: { uid: string; displayName: string; avatar: string }) => {
    setActionError(null);
    setOpenDropdownId(null);
    try {
      await blockUser(currentUid, target, currentUserName, currentUserAvatar);
    } catch (err: any) {
      setActionError(err.message || "Failed to block user.");
    }
  };

  const handleUnblock = async (friendshipId: string) => {
    setActionError(null);
    try {
      await unblockUser(friendshipId);
    } catch (err: any) {
      setActionError(err.message || "Failed to unblock user.");
    }
  };

  const handleInviteToGame = async (friend: { uid: string; displayName: string; avatar: string }) => {
    setActionError(null);
    setInvitingFriendId(friend.uid);
    try {
      let roomCodeToUse = activeOnlineRoomCode;

      // If host is not currently in an online room, spin up a quick private room
      if (!roomCodeToUse) {
        const newRoom = await createRoom(currentUserName, false, 4, 60);
        roomCodeToUse = newRoom.code;

        if (onStartOnlineGame) {
          onStartOnlineGame(
            [
              {
                id: currentUid,
                name: currentUserName,
                isBot: false,
                inkColor: "text-blue-700",
                avatar: currentUserAvatar
              }
            ],
            newRoom.code
          );
        }
      }

      await sendGameInvite(
        { uid: currentUid, displayName: currentUserName, avatar: currentUserAvatar },
        { uid: friend.uid, displayName: friend.displayName },
        roomCodeToUse
      );

      setInviteSuccessId(friend.uid);
      setTimeout(() => setInviteSuccessId(null), 3000);
    } catch (err: any) {
      setActionError(err.message || "Failed to send match invite.");
    } finally {
      setInvitingFriendId(null);
    }
  };

  if (!isOpen) return null;

  // Filter friends by query
  const filteredFriends = acceptedFriendships.filter((f) => {
    const friendName = f.senderId === currentUid ? f.receiverName : f.senderName;
    return friendName.toLowerCase().includes(friendFilter.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        id="friends-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-800 dark:text-slate-100"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <span>Classroom Friends</span>
                <span className="text-xs font-sans px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold">
                  {acceptedFriendships.length}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connect with classmates, challenge friends, and play multiplayer matches
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Error Banner */}
        {actionError && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-rose-500 hover:text-rose-700 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center px-6 pt-3 border-b border-slate-100 dark:border-slate-800/80 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab("friends");
              setActionError(null);
            }}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "friends"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Friends</span>
            {acceptedFriendships.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] flex items-center justify-center">
                {acceptedFriendships.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("requests");
              setActionError(null);
            }}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "requests"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Requests</span>
            {incomingRequests.length > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-bold animate-pulse">
                {incomingRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("add");
              setActionError(null);
            }}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "add"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Friend</span>
          </button>

          {blockedList.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveTab("blocked");
                setActionError(null);
              }}
              className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === "blocked"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Blocked ({blockedList.length})</span>
            </button>
          )}
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: FRIENDS LIST */}
          {activeTab === "friends" && (
            <div className="space-y-4">
              {/* Search within friends */}
              {acceptedFriendships.length > 0 && (
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={friendFilter}
                    onChange={(e) => setFriendFilter(e.target.value)}
                    placeholder="Search in your friends list..."
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {friendFilter && (
                    <button
                      type="button"
                      onClick={() => setFriendFilter("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {filteredFriends.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-14 h-14 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mx-auto text-2xl border border-indigo-100 dark:border-indigo-900/50">
                    👥
                  </div>
                  <h3 className="font-display font-bold text-sm text-slate-700 dark:text-slate-200">
                    {friendFilter ? "No friends matching search" : "Your friends list is empty"}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {friendFilter
                      ? "Try searching for a different name or clear the filter."
                      : "Search for fellow vocabulary scholars or share your Friend Code to invite others to play!"}
                  </p>
                  {!friendFilter && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("add")}
                      className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer inline-flex items-center gap-2"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Find & Add Friends</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {filteredFriends.map((f) => {
                    const isSender = f.senderId === currentUid;
                    const friendUid = isSender ? f.receiverId : f.senderId;
                    const friendName = isSender ? f.receiverName : f.senderName;
                    const friendAvatar = isSender ? f.receiverAvatar : f.senderAvatar;
                    const isInviting = invitingFriendId === friendUid;
                    const inviteSuccess = inviteSuccessId === friendUid;

                    return (
                      <div
                        key={f.id}
                        className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3 hover:border-indigo-300 dark:hover:border-indigo-700/60 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Avatar & Online status */}
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-xl shadow-xs">
                              {friendAvatar || "🎓"}
                            </div>
                            <span
                              title="Online in Word Arena"
                              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800"
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs truncate text-slate-900 dark:text-white">
                                {friendName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                <Circle className="w-1.5 h-1.5 fill-emerald-500 text-emerald-500" />
                                Online
                              </span>
                              <span>•</span>
                              <span className="text-[10px] font-mono text-slate-400">
                                #{friendUid.slice(0, 6)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Friend Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleInviteToGame({
                                uid: friendUid,
                                displayName: friendName,
                                avatar: friendAvatar
                              })
                            }
                            disabled={isInviting || Boolean(inviteSuccess)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                              inviteSuccess
                                ? "bg-emerald-500 text-white"
                                : "bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white"
                            }`}
                          >
                            {isInviting ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Inviting...</span>
                              </>
                            ) : inviteSuccess ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Invite Sent!</span>
                              </>
                            ) : (
                              <>
                                <Gamepad2 className="w-3.5 h-3.5" />
                                <span>Invite to Game</span>
                              </>
                            )}
                          </button>

                          {/* Options dropdown */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenDropdownId(openDropdownId === f.id ? null : f.id)
                              }
                              className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-500 flex items-center justify-center cursor-pointer"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {openDropdownId === f.id && (
                              <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 py-1 text-xs">
                                <button
                                  type="button"
                                  onClick={() => handleRejectOrRemove(f.id)}
                                  className="w-full text-left px-3 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Remove Friend</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleBlockUser({
                                      uid: friendUid,
                                      displayName: friendName,
                                      avatar: friendAvatar
                                    })
                                  }
                                  className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-2 cursor-pointer"
                                >
                                  <Shield className="w-3.5 h-3.5" />
                                  <span>Block Player</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REQUESTS */}
          {activeTab === "requests" && (
            <div className="space-y-6">
              {/* Incoming Requests */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span>Incoming Friend Requests</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px]">
                    {incomingRequests.length}
                  </span>
                </h3>

                {incomingRequests.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-center text-xs text-slate-500">
                    No pending friend requests at this time.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {incomingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xl shrink-0">
                            {req.senderAvatar || "🎓"}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">
                              {req.senderName}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Sent {new Date(req.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAcceptRequest(req.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Accept</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectOrRemove(req.id)}
                            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Decline</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Outgoing Requests */}
              {outgoingRequests.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Sent Requests ({outgoingRequests.length})
                  </h3>
                  <div className="space-y-2">
                    {outgoingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-xl shrink-0">
                            {req.receiverAvatar || "🎓"}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">
                              {req.receiverName}
                            </span>
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              Waiting for response...
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRejectOrRemove(req.id)}
                          className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/40 hover:text-rose-600 rounded-xl text-xs font-bold cursor-pointer transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ADD FRIEND */}
          {activeTab === "add" && (
            <div className="space-y-5">
              {/* My Friend Code Box */}
              <div className="p-4 rounded-2xl bg-linear-to-r from-indigo-500/10 via-purple-500/10 to-blue-500/10 border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    Your Friend UID Code
                  </span>
                  <div className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 bg-white/70 dark:bg-slate-900/70 px-3 py-1.5 rounded-xl border border-indigo-500/20">
                    {currentUid}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyMyCode}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95 shrink-0"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy My Code</span>
                    </>
                  )}
                </button>
              </div>

              {/* Search Bar */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Search by Scholar Name or Player UID
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type name (e.g. Scholar, Emma, Alex) or paste full UID..."
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-10 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  />
                  {isSearching && (
                    <RefreshCw className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin" />
                  )}
                </div>
              </div>

              {/* Search Results */}
              <div className="space-y-2">
                {searchQuery.trim() && (
                  <h4 className="text-xs font-bold text-slate-500">
                    Search Results ({searchResults.length})
                  </h4>
                )}

                {searchQuery.trim() && searchResults.length === 0 && !isSearching && (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                    No players found matching "{searchQuery}". Try a different name or full UID code.
                  </div>
                )}

                <div className="space-y-2">
                  {searchResults.map((user) => {
                    const badge = getRankBadgeColor(user.rating);
                    return (
                      <div
                        key={user.uid}
                        className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-xl shrink-0">
                            {user.avatar || "🎓"}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">
                              {user.displayName}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                              <span className={`font-bold ${badge.text}`}>
                                {user.rating} Elo
                              </span>
                              <span>•</span>
                              <span className="text-indigo-600 dark:text-indigo-400">
                                {user.league}
                              </span>
                              <span>•</span>
                              <span>{user.totalWins} wins</span>
                            </div>
                          </div>
                        </div>

                        {/* Relationship state button */}
                        <div className="shrink-0">
                          {user.friendshipStatus === "friends" ? (
                            <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Friends</span>
                            </span>
                          ) : user.friendshipStatus === "pending_sent" ? (
                            <span className="px-3 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-xl text-xs font-bold flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Pending</span>
                            </span>
                          ) : user.friendshipStatus === "pending_received" ? (
                            <button
                              type="button"
                              onClick={() =>
                                user.friendshipId && handleAcceptRequest(user.friendshipId)
                              }
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Accept</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSendRequest(user)}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Add Friend</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BLOCKED */}
          {activeTab === "blocked" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Blocked players cannot send you friend requests or invite you to games.
              </p>
              <div className="space-y-2">
                {blockedList.map((b) => {
                  const targetName = b.senderId === currentUid ? b.receiverName : b.senderName;
                  return (
                    <div
                      key={b.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-slate-400" />
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                          {targetName}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUnblock(b.id)}
                        className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer transition-all"
                      >
                        Unblock
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
