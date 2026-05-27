import { Card, CardBody, CardText } from "reactstrap";
import "./MessageBoard.css";

const MessageItem = (message) => {
  return (
    <Card className="miles-card">
      <CardBody>
        <CardText>{message.message}</CardText>
      </CardBody>
    </Card>
  );
};

export default MessageItem;
