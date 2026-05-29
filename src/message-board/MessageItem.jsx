import { useState } from "react";
import { BsThreeDots } from "react-icons/bs";
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

const MessageItem = ({ message, onEdit, onDelete }) => {
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
    <Card className="message-card">
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
          <CardText>{message.content}</CardText>
        )}
      </CardBody>
    </Card>
  );
};

export default MessageItem;
