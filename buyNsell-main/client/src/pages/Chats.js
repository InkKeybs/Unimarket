import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LoaderIcon, toast } from "react-hot-toast";
import axios from "axios";
import styles from "./Chats.module.scss";

function Chats() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  const loadChatList = async (myId) => {
    try {
      const res = await axios({
        method: "post",
        baseURL: `${process.env.REACT_APP_BASEURL}`,
        url: "/api/getChatList",
        data: { userId: myId },
      });
      setConversations(res.data.conversations || []);
    } catch (error) {
      console.log(error);
    }
  };

  const loadMessages = async (myId, chat) => {
    if (!chat) return;
    setLoadingMessages(true);
    try {
      const res = await axios({
        method: "post",
        baseURL: `${process.env.REACT_APP_BASEURL}`,
        url: "/api/getMessages",
        data: {
          productId: chat.productId,
          userId: myId,
          otherUserId: chat.otherUserId,
        },
      });
      setMessages(res.data.messages || []);
      await loadChatList(myId);
    } catch (error) {
      console.log(error);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("token"));
    if (!token) {
      navigate("/login");
      return;
    }

    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api",
      data: { token },
    })
      .then(async (response) => {
        const myId = response.data.userid;
        setUserId(myId);
        await loadChatList(myId);
        setLoading(false);
      })
      .catch((error) => {
        console.log(error);
        navigate("/login");
      });
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(async () => {
      await loadChatList(userId);
      if (activeChat) {
        await loadMessages(userId, activeChat);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [userId, activeChat]);

  const handleOpenConversation = async (chat) => {
    setActiveChat(chat);
    await loadMessages(userId, chat);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!activeChat || !newMessage.trim()) return;

    try {
      await axios({
        method: "post",
        baseURL: `${process.env.REACT_APP_BASEURL}`,
        url: "/api/sendMessage",
        data: {
          productId: activeChat.productId,
          senderId: userId,
          receiverId: activeChat.otherUserId,
          message: newMessage.trim(),
        },
      });
      setNewMessage("");
      await loadMessages(userId, activeChat);
    } catch (error) {
      console.log(error);
      toast.error("Failed to send message");
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <LoaderIcon />
      </div>
    );
  }

  return (
    <div className={styles.chatsPage}>
      <div className={styles.topBar}>
        <h1>Chats</h1>
        <Link to="/">Back to Home</Link>
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Conversations</div>
          {conversations.length === 0 ? (
            <div className={styles.emptySidebar}>No conversations yet</div>
          ) : (
            conversations.map((chat) => (
              <button
                type="button"
                key={`${chat.productId}_${chat.otherUserId}`}
                className={`${styles.chatRow} ${
                  activeChat &&
                  activeChat.productId === chat.productId &&
                  activeChat.otherUserId === chat.otherUserId
                    ? styles.activeRow
                    : ""
                }`}
                onClick={() => handleOpenConversation(chat)}
              >
                <img src={chat.productImage} alt="product" />
                <div className={styles.chatRowInfo}>
                  <div className={styles.chatRowName}>{chat.otherUserName}</div>
                  <div className={styles.chatRowProduct}>{chat.productName}</div>
                  <div className={styles.chatRowLast}>{chat.lastMessage || "No message yet"}</div>
                </div>
                {chat.unreadCount > 0 ? <span>{chat.unreadCount}</span> : null}
              </button>
            ))
          )}
        </aside>

        <section className={styles.chatPane}>
          {!activeChat ? (
            <div className={styles.emptyChat}>Select a conversation to start</div>
          ) : (
            <>
              <div className={styles.chatHeader}>
                <img src={activeChat.productImage} alt="product" />
                <div>
                  <h2>{activeChat.otherUserName}</h2>
                  <p>About: {activeChat.productName}</p>
                </div>
              </div>

              <div className={styles.messages}>
                {loadingMessages ? (
                  <LoaderIcon />
                ) : messages.length === 0 ? (
                  <div className={styles.emptyMessages}>No messages yet</div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg._id}
                      className={`${styles.messageBubble} ${
                        msg.senderId?._id === userId ? styles.sent : styles.received
                      }`}
                    >
                      {msg.message ? <div>{msg.message}</div> : null}
                      {msg.imageData ? <img src={msg.imageData} alt="chat upload" /> : null}
                      <small>{msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ""}</small>
                    </div>
                  ))
                )}
              </div>

              <form className={styles.messageForm} onSubmit={handleSendMessage}>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button type="submit">Send</button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default Chats;
