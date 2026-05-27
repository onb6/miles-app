import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./LandingPage";
import MessageBoard from "./message-board/MessageBoard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/messages" element={<MessageBoard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
