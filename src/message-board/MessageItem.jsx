import { useState } from "react";
import {
  Card,
  CardBody,
  CardText,
  CardSubtitle,
  Button,
  Input,
} from "reactstrap";
import "./MessageBoard.css";

const MessageItem = ({ message, onEdit, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

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

  return (
    <Card className="message-card">
      {message.image_url && (
        <img
          src={message.image_url}
          alt="attachment"
          className="message-card-img"
        />
      )}
      <CardBody>
        <CardSubtitle className="text-muted" style={{ fontSize: "0.8rem" }}>
          {message.author} &middot;{" "}
          {new Date(message.created_at).toLocaleString()}
        </CardSubtitle>
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
              <Button size="sm" onClick={handleSave}>
                Save
              </Button>
              <Button size="sm" color="secondary" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <CardText>{message.content}</CardText>
        )}
        <div className="message-actions">
          {onEdit && !editing && (
            <Button
              size="sm"
              color="outline-secondary"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              color="danger"
              onClick={() => onDelete(message.id)}
            >
              Delete
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

export default MessageItem;
