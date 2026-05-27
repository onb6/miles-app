import { useState, useEffect } from "react";
import "./MessageBoard.css";
import { Button, Input } from "reactstrap";
import MessageItem from "./MessageItem";
import { useNavigate } from "react-router-dom";
import { BiArrowBack } from "react-icons/bi";

const MessageBoard = () => {
  const [messages, setMessages] = useState([]);
  const [addingMessage, setAddingMessage] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/messages");
      if (!res.ok) throw new Error("Failed to load messages");
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMessage = async () => {
    if (!messageText.trim()) return;
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageText }),
      });
      if (!res.ok) throw new Error("Failed to post message");
      const newMessage = await res.json();
      setMessages([newMessage, ...messages]);
      setAddingMessage(false);
      setMessageText("");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteMessage = async (id) => {
    try {
      const res = await fetch(`/api/messages/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete message");
      setMessages(messages.filter((m) => m.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="landing-page-container">
      <div className="messsage-board-header">
        <Button onClick={() => navigate("/")}>
          <BiArrowBack className="back-button-icon" />
          Back
        </Button>
        <h2>Message Board</h2>
      </div>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div className="message-board-content">
        <Button onClick={() => setAddingMessage(true)} disabled={addingMessage}>
          Add a message
        </Button>
        {addingMessage && (
          <div className="input-section">
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddMessage()}
              placeholder="Write a message..."
            />
            <Button onClick={handleAddMessage}>Submit</Button>
            <Button color="secondary" onClick={() => setAddingMessage(false)}>
              Cancel
            </Button>
          </div>
        )}
        {loading ? (
          <p>Loading messages...</p>
        ) : (
          messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              onDelete={handleDeleteMessage}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default MessageBoard;
