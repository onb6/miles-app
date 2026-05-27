import { useState } from "react";
import "./MessageBoard.css";
import { Button, Input } from "reactstrap";
import MessageItem from "./MessageItem";

const MessageBoard = (currentUser) => {
  const [currentMessages, setCurrentMessages] = useState([]);
  const [addingMessage, setAddingMessage] = useState(false);
  const [messageTyping, setMessageTyping] = useState("");

  const handleKeyPress = (i) => {
    setMessageTyping(i.target.value);
  };

  const handleAddMessage = () => {
    setCurrentMessages([messageTyping].concat(currentMessages));
    setAddingMessage(false);
    setMessageTyping("");
  };

  console.log(currentMessages);

  return (
    <div className="landing-page-container">
      <h1>Message Board</h1>
      <div className="message-board-content">
        <Button onClick={() => setAddingMessage(true)} disabled={addingMessage}>
          Add a message
        </Button>
        {addingMessage ? (
          <div className="input-section">
            <Input onKeyDown={handleKeyPress} />
            <Button onClick={handleAddMessage}>Submit</Button>
          </div>
        ) : (
          <div />
        )}
        {currentMessages.map((message) => (
          <MessageItem message={message} />
        ))}
      </div>
    </div>
  );
};

export default MessageBoard;
