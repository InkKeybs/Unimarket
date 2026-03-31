import Register from "./pages/Register";
import EmailVerify from "./pages/EmailVerify";
import { Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import Sell from "./pages/Sell";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Product from "./pages/Product";
import Shops from "./pages/Shops";
import FixDeal from "./pages/FixDeal";
import Chat from "./pages/Chat";
import Admin from "./pages/Admin";
import ChatWidget from "./components/ChatWidget/ChatWidget";

const THEME_STORAGE_KEY = "theme";

function App() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const darkEnabled = storedTheme ? storedTheme === "dark" : prefersDark;
    setIsDark(darkEnabled);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <>
      <button
        type="button"
        className={`themeToggle ${isDark ? "isDark" : "isLight"}`}
        onClick={() => setIsDark((prev) => !prev)}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        <span className="themeToggleIcon" aria-hidden="true"></span>
        <span className="srOnly">
          {isDark ? "Switch to light mode" : "Switch to dark mode"}
        </span>
      </button>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/users/:id/verify/:token/" element={<EmailVerify />} />
        <Route path="/sell" element={<Sell />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/buy-product/:prod/:seller/:buyer" element={<FixDeal />} />
        <Route path="/product/:prod" element={<Product />} />
        <Route path="/shops" element={<Shops />} />
        <Route path="/chat/:productId/:otherUserId" element={<Chat />} />
      </Routes>
      <ChatWidget />
    </>
  );
}

export default App;
