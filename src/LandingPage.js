import "./LandingPage.css";
import MilesCard from "./components/MilesCard";
import OlipopImg from "./assets/olipop.png";
import LoadingImg from "./assets/loading.png";
import MessageImg from "./assets/messages.jpg";
import { Button } from "reactstrap";
import { useAuth } from "./context/AuthContext";
import { useNavigate } from "react-router-dom";

const LandingPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };
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
      <div className="landing-page-header">
        <span className="header-username">{user?.username}</span>
        <Button color="outline-secondary" size="sm" onClick={handleLogout}>
          Log out
        </Button>
      </div>
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
