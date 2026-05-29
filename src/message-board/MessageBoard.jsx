import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BiArrowBack } from "react-icons/bi";
import { useAuth } from "../context/AuthContext";
import "./MessageBoard.css";
import { Button, Input } from "reactstrap";
import MessageItem from "./MessageItem";

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

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/messages", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load messages");
      setMessages(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
    <div className="landing-page-container">
      <div className="messsage-board-header">
        <Button
          color="outline-secondary"
          size="sm"
          onClick={() => navigate("/")}
        >
          <BiArrowBack className="back-button-icon" />
          Back
        </Button>
        <h2>Message Board</h2>
        <div className="header-user">
          <span className="header-username">{user?.username}</span>
          <Button color="outline-secondary" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </div>

      {error && <p style={{ color: "red", marginTop: "1rem" }}>{error}</p>}

      <div className="message-board-content">
        {loading ? (
          <p>Loading messages...</p>
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
            {messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                onEdit={
                  message.user_id === user?.user_id ? handleEditMessage : null
                }
                onDelete={
                  message.user_id === user?.user_id ? handleDeleteMessage : null
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBoard;
