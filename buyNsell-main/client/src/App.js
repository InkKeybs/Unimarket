import Register from "./pages/Register";
import EmailVerify from "./pages/EmailVerify";
import { Routes, Route } from "react-router-dom";
import Sell from "./pages/Sell";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Product from "./pages/Product";
import FixDeal from "./pages/FixDeal";
import Chat from "./pages/Chat";
import Admin from "./pages/Admin";
import ChatWidget from "./components/ChatWidget/ChatWidget";

function App() {

  return (
    <>
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
        <Route path="/chat/:productId/:otherUserId" element={<Chat />} />
      </Routes>
      <ChatWidget />
    </>
  );
}

export default App;
