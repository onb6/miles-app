import "./LandingPage.css";
import MilesCard from "./components/MilesCard";
import OlipopImg from "./assets/olipop.png";
import LoadingImg from "./assets/loading.png";
import MessageImg from "./assets/messages.jpg";
import { Input } from "reactstrap";

const LandingPage = () => {
  const items = [
    {
      title: "Olipop Ranking",
      subtitle: "To keep track of our Olipop ranking!",
      text: "Coming soooooon :)",
      buttonText: "Let's Go!",
      buttonDisabled: true,
      cardImg: OlipopImg,
    },
    {
      title: "Message Board",
      subtitle: "Let's leave each other cute lil notes!",
      text: "Because I'm always thinking about you :)",
      buttonText: "Get Messaging",
      buttonDisabled: false,
      buttonLink: "/messages",
      cardImg: MessageImg,
    },
    {
      title: "Another app",
      subtitle: "Going to figure out more thingssss!",
      text: "I love youuuuu",
      buttonText: "Let's Go!",
      buttonDisabled: true,
      cardImg: LoadingImg,
    },
  ];

  return (
    <div className="landing-page-container">
      <h1>Hi Miles! I love you!</h1>
      <div className="card-wrapper">
        {items.map((item) => (
          <MilesCard id={item.title} content={item} />
        ))}
      </div>
    </div>
  );
};

export default LandingPage;
