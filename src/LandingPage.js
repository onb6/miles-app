import "./LandingPage.css";
import MilesCard from "./components/MilesCard";
import OlipopImg from "./assets/olipop.png";
import StampsImg from "./assets/stamps.jpg";
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
      title: "Message Board",
      subtitle: "Let's leave each other cute lil notes!",
      text: "Because I'm always thinking about you :)",
      buttonText: "Get Messaging",
      buttonDisabled: false,
      buttonLink: "/messages",
      cardImg: MessageImg,
    },
    {
      title: "Olipop Ranking",
      subtitle: "To keep track of our Olipop ranking!",
      text: "Rank your favourite flavors!",
      buttonText: "Let's Go!",
      buttonDisabled: false,
      buttonLink: "/olipop",
      cardImg: OlipopImg,
    },
    {
      title: "Stamp Collection",
      subtitle: "Browse stamps and build your wishlist!",
      text: "2026 USPS stamps with all the details",
      buttonText: "Browse Stamps",
      buttonDisabled: false,
      buttonLink: "/stamps",
      cardImg: StampsImg,
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
