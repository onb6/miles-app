import {
  Card,
  CardBody,
  CardTitle,
  CardSubtitle,
  CardText,
  Button,
} from "reactstrap";
import "./MilesCard.css";

const MilesCard = (content) => {
  return (
    <Card className="miles-card">
      <img alt="Sample" src="https://picsum.photos/300/200" />
      <CardBody>
        <CardTitle className="miles-card-title" tag="h5">
          {content.content.title}
        </CardTitle>
        <CardSubtitle className="mb-2 text-muted" tag="h6">
          {content.content.subtitle}
        </CardSubtitle>
        <CardText>{content.content.text}</CardText>
        <Button disabled={content.content.buttonDisabled}>
          {content.content.buttonText}
        </Button>
      </CardBody>
    </Card>
  );
};

export default MilesCard;
