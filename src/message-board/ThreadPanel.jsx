import { useState, useEffect, useRef } from "react";
import { BsX } from "react-icons/bs";
import { Button, Input } from "reactstrap";
import MessageItem from "./MessageItem";
import "./ThreadPanel.css";

const ThreadPanel = ({ message, unreadSince, currentUser, onClose, onReplyPosted }) => {
  const isUnread = (reply) => {
    if (reply.user_id === currentUser?.user_id) return false;
    return !unreadSince || new Date(reply.created_at) > new Date(unreadSince);
  };
  const [replies, setReplies] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const repliesEndRef = useRef(null);

  useEffect(() => {
    fetch(`/api/messages/${message.id}/replies`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { setReplies(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [message.id]);

  useEffect(() => {
    repliesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies]);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    const formData = new FormData();
    formData.append("content", replyText);
    formData.append("parent_id", message.id);
    const res = await fetch("/api/messages", {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (res.ok) {
      const newReply = await res.json();
      setReplies((prev) => [...prev, newReply]);
      setReplyText("");
      onReplyPosted?.(message.id);
    }
  };

  const handleEditReply = async (id, content) => {
    const res = await fetch(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const updated = await res.json();
      setReplies((prev) => prev.map((r) => (r.id === id ? updated : r)));
    }
  };

  const handleDeleteReply = async (id) => {
    const res = await fetch(`/api/messages/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) setReplies((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="thread-panel">
      <div className="thread-panel-header">
        <span className="thread-panel-title">Thread</span>
        <button className="thread-close-btn" onClick={onClose}>
          <BsX size={20} />
        </button>
      </div>

      <div className="thread-root">
        {message.image_url && (
          <img src={message.image_url} alt="" className="thread-root-img" />
        )}
        <p className="thread-root-author">{message.author}</p>
        <p className="thread-root-content">{message.content}</p>
      </div>

      <div className="thread-replies-header">
        {loading ? "" : `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
      </div>

      <div className="thread-replies">
        {loading ? (
          <p className="thread-loading">Loading…</p>
        ) : (
          replies.map((reply) => (
            <div key={reply.id} className="reply-wrapper">
              {isUnread(reply) && <span className="thread-reply-unread-dot" />}
              <MessageItem
                message={reply}
                onEdit={reply.user_id === currentUser?.user_id ? handleEditReply : null}
                onDelete={reply.user_id === currentUser?.user_id ? handleDeleteReply : null}
              />
            </div>
          ))
        )}
        <div ref={repliesEndRef} />
      </div>

      <div className="thread-compose">
        <Input
          bsSize="sm"
          placeholder="Reply…"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleReply()}
        />
        <Button
          size="sm"
          color="primary"
          onClick={handleReply}
          disabled={!replyText.trim()}
        >
          Send
        </Button>
      </div>
    </div>
  );
};

export default ThreadPanel;
