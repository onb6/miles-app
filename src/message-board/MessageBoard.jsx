import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./MessageBoard.css";
import { Button, Input } from "reactstrap";
import MessageItem from "./MessageItem";
import ThreadPanel from "./ThreadPanel";

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const POSTIT_COLORS = [
  "#fef08a", // yellow
  "#fbcfe8", // pink
  "#bae6fd", // sky blue
  "#bbf7d0", // mint
  "#fed7aa", // peach
  "#ddd6fe", // lavender
];

const MessageBoard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [addingMessage, setAddingMessage] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openThread, setOpenThread] = useState(null);
  const [readTimestamps, setReadTimestamps] = useState({});
  const [newMessageIds, setNewMessageIds] = useState(new Set());
  const didFetch = useRef(false);

  const handleReplyPosted = (messageId) => {
    const now = new Date().toISOString();
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              reply_count: (m.reply_count || 0) + 1,
              latest_reply_at: now,
            }
          : m,
      ),
    );
    setReadTimestamps((prev) => ({ ...prev, [messageId]: now }));
    fetch(`/api/read/thread/${messageId}`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  };

  const openThread_ = (message, messageIndex) => {
    const prevReadAt = readTimestamps[message.id] || null;
    const rootColor = POSTIT_COLORS[(messageIndex + 1) % 6];
    setOpenThread({ message, unreadSince: prevReadAt, rootColor });
    setNewMessageIds((prev) => {
      const next = new Set(prev);
      next.delete(message.id);
      return next;
    });
    setReadTimestamps((prev) => ({
      ...prev,
      [message.id]: new Date().toISOString(),
    }));
    fetch(`/api/read/thread/${message.id}`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  };

  const hasUnread = (msg) => {
    if (!msg.reply_count || !msg.latest_reply_at) return false;
    const lastRead = readTimestamps[msg.id];
    return !lastRead || new Date(msg.latest_reply_at) > new Date(lastRead);
  };

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    Promise.all([
      fetch("/api/messages", { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Failed to load messages");
        return r.json();
      }),
      fetch("/api/read/board", { method: "POST", credentials: "include" }).then(
        (r) => (r.ok ? r.json() : {}),
      ),
    ])
      .then(([msgs, readState]) => {
        setMessages(msgs);
        setReadTimestamps(readState.thread_reads || {});
        if (readState.prev_visited_at) {
          const lastVisit = new Date(readState.prev_visited_at);
          setNewMessageIds(
            new Set(
              msgs
                .filter(
                  (m) =>
                    m.user_id !== user?.user_id &&
                    new Date(m.created_at) > lastVisit,
                )
                .map((m) => m.id),
            ),
          );
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleCancel = () => {
    setAddingMessage(false);
    setMessageText("");
    clearImage();
  };

  const handleAddMessage = async () => {
    if (!messageText.trim()) return;
    try {
      const formData = new FormData();
      formData.append("content", messageText);
      if (imageFile) formData.append("image", imageFile);

      const res = await fetch("/api/messages", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to post message");
      setMessages([await res.json(), ...messages]);
      setAddingMessage(false);
      setMessageText("");
      clearImage();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditMessage = async (id, content) => {
    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to update message");
      const updated = await res.json();
      setMessages(messages.map((m) => (m.id === id ? updated : m)));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteMessage = async (id) => {
    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete message");
      setMessages(messages.filter((m) => m.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="landing-page-container message-board-page">
      <div className="messsage-board-header">
        <button className="header-badge-btn" onClick={() => navigate("/")}>
          <img src="/favicon.svg" alt="Home" />
        </button>
        <h2>Message Board</h2>
        <div className="header-user">
          <span className="header-username">{cap(user?.username)}</span>
          <Button color="outline-secondary" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </div>

      {error && <p style={{ color: "red", marginTop: "1rem" }}>{error}</p>}

      <div
        className={`message-board-content${openThread ? " thread-open" : ""}`}
      >
        {loading ? (
          <p style={{ color: "white" }}>Loading messages...</p>
        ) : (
          <div className="masonry-grid">
            <div className="message-card compose-card">
              <div className="compose-card-body">
                Post your message here:
                <Input
                  value={messageText}
                  onChange={(e) => {
                    setMessageText(e.target.value);
                    if (!addingMessage) setAddingMessage(true);
                  }}
                  onFocus={() => setAddingMessage(true)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddMessage()}
                  placeholder="Write a message..."
                />
                {addingMessage && (
                  <>
                    <div className="image-upload-row">
                      <label className="image-upload-label">
                        Add a photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          style={{ display: "none" }}
                        />
                      </label>
                      {imagePreview && (
                        <div className="image-preview-wrapper">
                          <img
                            src={imagePreview}
                            alt="preview"
                            className="image-preview"
                          />
                          <button
                            className="image-remove-btn"
                            onClick={clearImage}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="compose-actions">
                      <Button
                        size="sm"
                        color="outline-secondary"
                        onClick={handleCancel}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        color="primary"
                        onClick={handleAddMessage}
                        disabled={messageText === ""}
                      >
                        Submit
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
            {messages.map((message, i) => (
              <MessageItem
                key={message.id}
                message={message}
                onEdit={
                  message.user_id === user?.user_id ? handleEditMessage : null
                }
                onDelete={
                  message.user_id === user?.user_id ? handleDeleteMessage : null
                }
                onReply={(msg) => openThread_(msg, i)}
                hasUnread={hasUnread(message)}
                isNew={newMessageIds.has(message.id)}
                isActive={openThread?.message?.id === message.id}
              />
            ))}
          </div>
        )}
      </div>

      {openThread && (
        <ThreadPanel
          message={openThread.message}
          unreadSince={openThread.unreadSince}
          rootColor={openThread.rootColor}
          currentUser={user}
          onClose={() => setOpenThread(null)}
          onReplyPosted={handleReplyPosted}
        />
      )}
    </div>
  );
};

export default MessageBoard;
