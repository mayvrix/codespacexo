// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Intro from "./pages/Intro.jsx";      // NEW
import Entry from "./pages/Entry.jsx";
import Signup from "./pages/Signup.jsx";
import Home from "./pages/Home.jsx";
import Public from "./pages/public.jsx";
import Update from "./pages/update.jsx";
import Dash from "./pages/DashXO.jsx";
import Feedback from "./pages/Feedback.jsx";
import Bin from "./pages/Bin.jsx";
import Notice from "./pages/Notice.jsx";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Intro />} />        {/* initial root -> Intro */}
        <Route path="/entry" element={<Entry />} />   {/* Entry moved to /entry */}
        <Route path="/signup" element={<Signup />} />
        <Route path="/home" element={<Home />} />
        <Route path="/public" element={<Public />} />
        <Route path="/update" element={<Update />} />
        <Route path="/dashXO" element={<Dash />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/bin" element={<Bin />} />
        <Route path="/notice" element={<Notice />} />
      </Routes>
    </Router>
  );
}
