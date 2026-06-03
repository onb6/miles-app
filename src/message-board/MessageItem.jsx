import { useState } from "react";
import { BsThreeDots, BsChat } from "react-icons/bs";
import {
  Card,
  CardBody,
  CardText,
  CardSubtitle,
  Button,
  Input,
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
} from "reactstrap";
import "./MessageBoard.css";

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
}) => {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [menuOpen, setMenuOpen] = useState(false);

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

  return (
    <Card
      className={`message-card${isNew || hasUnread ? " message-card-new" : ""}${isActive ? " message-card-active" : ""}`}
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
          {isNew && <span className="new-badge">NEW</span>}
          <CardSubtitle
            className="text-muted"
            style={{ fontSize: "0.8rem", margin: 0 }}
          >
            {message.author} &middot;{" "}
            {new Date(message.created_at).toLocaleString()}
          </CardSubtitle>
          {canAct && !editing && (
            <Dropdown
              isOpen={menuOpen}
              toggle={() => setMenuOpen((o) => !o)}
              direction="down"
            >
              <DropdownToggle tag="button" className="ellipsis-btn">
                <BsThreeDots />
              </DropdownToggle>
              <DropdownMenu end>
                {onEdit && (
                  <DropdownItem onClick={() => setEditing(true)}>
                    Edit
                  </DropdownItem>
                )}
                {onDelete && (
                  <DropdownItem
                    className="text-danger"
                    onClick={() => onDelete(message.id)}
                  >
                    Delete
                  </DropdownItem>
                )}
              </DropdownMenu>
            </Dropdown>
          )}
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
      </CardBody>
    </Card>
  );
};

export default MessageItem;
