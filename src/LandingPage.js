import "./LandingPage.css";
import MilesCard from "./components/MilesCard";
import OlipopImg from "./assets/olipop.png";
import StampsImg from "./assets/stamps.jpg";
import MessageImg from "./assets/messages.jpg";
import ProfileDropdown from "./components/ProfileDropdown";

const LandingPage = () => {
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
      title: "Stamp Collecting",
      subtitle: "Philately central! ;)",
      text: "2026 USPS stamps with all the details",
      buttonText: "Get Stampin'",
      buttonDisabled: false,
      buttonLink: "/stamps",
      cardImg: StampsImg,
    },
  ];

  return (
    <div className="landing-page-container">
      <div className="landing-page-header">
        <div className="header-right">
          <ProfileDropdown />
        </div>
      </div>
      <img
        src="/logo.svg"
        alt="olivialovesmiles.com"
        className="landing-logo"
      />
      <div className="card-wrapper">
        {items.map((item) => (
          <MilesCard id={item.title} content={item} />
        ))}
      </div>
    </div>
  );
};

export default LandingPage;
