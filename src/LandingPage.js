import "./LandingPage.css";
import MilesCard from "./MilesCard";

const LandingPage = () => {
  const items = [
    {
      title: "Olipop Ranking",
      subtitle: "A page to keep track of our Olipop ranking!",
      text: "Coming soooooon :)",
      buttonText: "Let's Go!",
      buttonDisabled: true,
    },
    {
      title: "Message Board",
      subtitle: "Let's leave each other notes!",
      text: "Because I'm always thinking about you :)",
      buttonText: "Get Messaging",
      buttonDisabled: true,
    },
    {
      title: "Another app",
      subtitle: "Going to figure out more thingssss!",
      text: "I love youuuuu",
      buttonText: "Let's Go!",
      buttonDisabled: true,
    },
  ];

  return (
    <div className="landing-page-container">
      <h1>Hi Miles! I love you!</h1>
      <div className="card-wrapper">
        {items.map((item) => (
          <MilesCard content={item} />
        ))}
      </div>
    </div>
  );
};

export default LandingPage;
