import { useState, useEffect, useRef } from "react";
import { BsThreeDots, BsChat } from "react-icons/bs";
import {
  Card,
  CardBody,
  CardText,
  CardSubtitle,
  Button,
  Input,
} from "reactstrap";
import "./MessageBoard.css";

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const URL_REGEX = /(https?:\/\/[^\s<>"']+)/g;

function linkify(text) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) =>
    URL_REGEX.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      part
    )
  );
}

const MessageItem = ({
  message,
  onEdit,
  onDelete,
  onReply,
  hasUnread,
  isNew,
  isActive,
  isUnreadReply,
}) => {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const handleSave = async () => {
    if (!editText.trim() || editText === message.content) {
      setEditing(false);
      return;
    }
    await onEdit(message.id, editText);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditText(message.content);
    setEditing(false);
  };

  const canAct = onEdit || onDelete;

  const handleCardClick = (e) => {
    if (!onReply || editing) return;
    if (e.target.closest("a, button, input")) return;
    onReply(message);
  };

  return (
    <Card
      className={`message-card${isNew || hasUnread ? " message-card-new" : ""}${isActive ? " message-card-active" : ""}`}
      onClick={handleCardClick}
      style={onReply && !editing ? { cursor: "pointer" } : undefined}
    >
      {message.image_url && (
        <img
          src={message.image_url}
          alt="attachment"
          className="message-card-img"
        />
      )}
      <CardBody>
        <div className="message-card-header">
          <CardSubtitle
            className="text-muted"
            style={{ fontSize: "0.8rem", margin: 0 }}
          >
            {cap(message.author)} &middot;{" "}
            {new Date(message.created_at).toLocaleString()}
          </CardSubtitle>
          <div className="message-card-header-right">
            {isUnreadReply && <span className="new-badge">new</span>}
            {canAct && !editing && (
              <div className="message-menu-wrap" ref={menuRef}>
                <button
                  className="ellipsis-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((o) => !o);
                  }}
                >
                  <BsThreeDots />
                </button>
                {menuOpen && (
                  <div className="message-menu">
                    {onEdit && (
                      <button
                        className="message-menu-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(true);
                          setMenuOpen(false);
                        }}
                      >
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        className="message-menu-item message-menu-item--danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(message.id);
                          setMenuOpen(false);
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {editing ? (
          <div className="edit-section">
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
            />
            <div className="edit-actions">
              <Button
                size="sm"
                color="outline-secondary"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button size="sm" color="primary" onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <CardText>{linkify(message.content)}</CardText>
        )}
        <div className="message-card-footer">
          {onReply && (
            <button
              className={`reply-btn${hasUnread ? " reply-btn-unread" : ""}`}
              onClick={() => onReply(message)}
            >
              <BsChat size={13} />
              {hasUnread && <span className="reply-unread-dot" />}
              <span>
                {!message.reply_count || message.reply_count === 0
                  ? "Reply"
                  : message.reply_count === 1
                    ? `${message.reply_count} reply`
                    : `${message.reply_count} replies`}
              </span>
            </button>
          )}
          {isNew && <span className="new-badge">new</span>}
        </div>
      </CardBody>
    </Card>
  );
};

export default MessageItem;
