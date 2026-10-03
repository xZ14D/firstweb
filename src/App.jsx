import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import About from "./pages/About";
import NotFound from "./pages/NotFound";

import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <nav>
        <img className="logoNav" src="src/logo.png"></img>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

//# make changes to your code in your editor
//git add .
//git commit -m "describe what you changed"
//git push
//# check vercel.com dashboard, site updates automatically