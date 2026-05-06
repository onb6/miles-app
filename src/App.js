import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./LandingPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/miles-app/" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
