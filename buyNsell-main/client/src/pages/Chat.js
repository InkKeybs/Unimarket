import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";
import styles from "./Chat.module.scss";

function Chat() {
  const { productId, otherUserId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [userId, setUserId] = useState("");
  const [otherUserName, setOtherUserName] = useState("");
  const [productName, setProductName] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("token"));
    if (!token) {
      navigate("/");
      return;
    }

    // Get user ID
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api",
      data: { token: token },
    })
      .then((response) => {
        const myId = response.data.userid;
        setUserId(myId);
        loadMessages(myId);
      })
      .catch((error) => {
        console.log(error);
        navigate("/");
      });
  }, [productId, otherUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = (myId) => {
    // Get product name
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/prodData",
      data: { id: productId },
    })
      .then((res) => {
        setProductName(res.data.data.pname);
      })
      .catch((err) => console.log(err));

    // Get other user's profile
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/profile",
      data: { id: otherUserId },
    })
      .then((res) => {
        setOtherUserName(res.data.data.name);
      })
      .catch((err) => console.log(err));

    // Get messages
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/getMessages",
      data: {
        productId: productId,
        userId: myId,
        otherUserId: otherUserId,
      },
    })
      .then((res) => {
        setMessages(res.data.messages);
        setLoading(false);
      })
      .catch((err) => {
        console.log(err);
        setLoading(false);
      });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/sendMessage",
      data: {
        productId: productId,
        senderId: userId,
        receiverId: otherUserId,
        message: newMessage.trim(),
      },
    })
      .then((res) => {
        setNewMessage("");
        loadMessages(userId);
      })
      .catch((err) => {
        console.log(err);
        toast.error("Failed to send message");
      });
  };

  // Auto-refresh messages every 3 seconds
  useEffect(() => {
    if (!userId) return;
    
    const interval = setInterval(() => {
      loadMessages(userId);
    }, 3000);

    return () => clearInterval(interval);
  }, [userId, productId, otherUserId]);

  if (loading) {
    return <div className={styles.loading}>Loading chat...</div>;
  }

  return (
    <div className={styles.chatPage}>
      <div className={styles.chatContainer}>
        <div className={styles.chatHeader}>
          <Link to="/profile" className={styles.backButton}>
            ← Back
          </Link>
          <div className={styles.chatInfo}>
            <h2>{otherUserName}</h2>
            <p>About: {productName}</p>
          </div>
        </div>

        <div className={styles.messagesContainer}>
          {messages.length === 0 ? (
            <div className={styles.noMessages}>
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`${styles.message} ${
                  msg.senderId._id === userId ? styles.sent : styles.received
                }`}
              >
                <div className={styles.messageContent}>{msg.message}</div>
                <div className={styles.messageTime}>
                  {new Date(msg.timestamp).toLocaleString()}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className={styles.messageInput} onSubmit={handleSendMessage}>
          <input
            type="text"
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}

export default Chat;
