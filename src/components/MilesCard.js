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
      <img
        className="miles-card-img"
        alt={content.content.title}
        src={content.content.cardImg || "https://picsum.photos/300/200"}
      />
      <CardBody>
        <CardTitle className="miles-card-title" tag="h5">
          {content.content.title}
        </CardTitle>
        <CardSubtitle className="mb-2 text-muted" tag="h6">
          {content.content.subtitle}
        </CardSubtitle>
        <CardText>{content.content.text}</CardText>
        <Button
          disabled={content.content.buttonDisabled}
          href={content.content.buttonLink}
          tag="a"
        >
          {content.content.buttonText}
        </Button>
      </CardBody>
    </Card>
  );
};

export default MilesCard;
