import { Card, CardBody, CardTitle, CardSubtitle, Button } from "reactstrap";
import "./MilesCard.css";

const MilesCard = ({ content }) => {
  return (
    <Card className="miles-card">
      <img
        className="miles-card-img"
        alt={content.title}
        src={content.cardImg || "https://picsum.photos/300/200"}
      />
      <CardBody>
        <CardTitle className="miles-card-title" tag="h5">
          {content.title}
        </CardTitle>
        <CardSubtitle className="mb-2 text-muted" tag="h6">
          {content.subtitle}
        </CardSubtitle>
        <Button
          disabled={content.buttonDisabled}
          href={content.buttonLink}
          tag="a"
          color="primary"
        >
          {content.buttonText}
        </Button>
      </CardBody>
    </Card>
  );
};

export default MilesCard;
