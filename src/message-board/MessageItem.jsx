import { Card, CardBody, CardText, CardSubtitle, Button } from "reactstrap";
import "./MessageBoard.css";

const MessageItem = ({ message, onDelete }) => {
  return (
    <Card className="message-card">
      <CardBody>
        <CardText>{message.content}</CardText>
        <CardSubtitle className="text-muted" style={{ fontSize: "0.8rem" }}>
          {message.author} &middot;{" "}
          {new Date(message.created_at).toLocaleString()}
        </CardSubtitle>
        {onDelete && (
          <Button
            color="danger"
            size="sm"
            style={{ marginTop: "0.5rem" }}
            onClick={() => onDelete(message.id)}
          >
            Delete
          </Button>
        )}
      </CardBody>
    </Card>
  );
};

export default MessageItem;
