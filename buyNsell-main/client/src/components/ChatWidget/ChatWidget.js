import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import styles from "./ChatWidget.module.scss";
import { useNavigate } from "react-router-dom";

function ChatWidget() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState("");
  const [chatList, setChatList] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [unreadTotal, setUnreadTotal] = useState(0);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("token"));
    if (!token || token === "") {
      setIsAuthenticated(false);
      setUserId("");
      setChatList([]);
      setActiveChat(null);
      setMessages([]);
      setIsOpen(false);
      return;
    }

    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api",
      data: { token: token },
    })
      .then((response) => {
        const myId = response.data.userid;
        // Only update if user changed
        if (myId !== userId) {
          setUserId(myId);
          setIsAuthenticated(true);
          setChatList([]);
          setActiveChat(null);
          setMessages([]);
          loadChatList(myId);
        }
      })
      .catch((error) => {
        console.log(error);
        setIsAuthenticated(false);
        setUserId("");
        setChatList([]);
        setActiveChat(null);
        setMessages([]);
      });

    // Check auth status periodically
    const authCheckInterval = setInterval(() => {
      const currentToken = JSON.parse(localStorage.getItem("token"));
      if (!currentToken || currentToken === "") {
        setIsAuthenticated(false);
        setUserId("");
        setChatList([]);
        setActiveChat(null);
        setMessages([]);
        setIsOpen(false);
      }
    }, 2000);

    return () => clearInterval(authCheckInterval);
  }, [userId]);

  // Listen for external chat open events
  useEffect(() => {
    const handleOpenChat = (event) => {
      const { productId, otherUserId, productName, otherUserName } = event.detail;
      if (!userId || !isAuthenticated) return;
      
      setIsOpen(true);
      setActiveChat({
        productId,
        otherUserId,
        productName,
        otherUserName,
      });
      loadMessages(userId, productId, otherUserId);
    };

    window.addEventListener('openChat', handleOpenChat);
    return () => window.removeEventListener('openChat', handleOpenChat);
  }, [userId, isAuthenticated]);

  // Auto-refresh chat list every 5 seconds
  useEffect(() => {
    if (!userId || !isAuthenticated) return;

    const interval = setInterval(() => {
      loadChatList(userId);
      if (activeChat) {
        loadMessages(userId, activeChat.productId, activeChat.otherUserId);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [userId, isAuthenticated, activeChat]);

  const loadChatList = (myId) => {
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/getChatList",
      data: { userId: myId },
    })
      .then((res) => {
        setChatList(res.data.conversations || []);
        const total = (res.data.conversations || []).reduce(
          (sum, chat) => sum + chat.unreadCount,
          0
        );
        setUnreadTotal(total);
      })
      .catch((err) => {
        console.log(err);
      });
  };

  const loadMessages = (myId, productId, otherUserId) => {
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
        // Reload chat list to update unread counts
        loadChatList(myId);
      })
      .catch((err) => {
        console.log(err);
      });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/sendMessage",
      data: {
        productId: activeChat.productId,
        senderId: userId,
        receiverId: activeChat.otherUserId,
        message: newMessage.trim(),
      },
    })
      .then((res) => {
        setNewMessage("");
        loadMessages(userId, activeChat.productId, activeChat.otherUserId);
        loadChatList(userId);
      })
      .catch((err) => {
        console.log(err);
        toast.error("Failed to send message");
      });
  };

  const openChat = (chat) => {
    setActiveChat(chat);
    loadMessages(userId, chat.productId, chat.otherUserId);
  };

  const closeActiveChat = () => {
    setActiveChat(null);
    setMessages([]);
    loadChatList(userId);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      {/* Chat Bubble Button */}
      <div
        className={`${styles.chatBubble} ${isOpen ? styles.open : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          "✕"
        ) : (
          <>
            💬
            {unreadTotal > 0 && (
              <span className={styles.badge}>{unreadTotal}</span>
            )}
          </>
        )}
      </div>

      {/* Chat Widget */}
      {isOpen && (
        <div className={styles.chatWidget}>
          {!activeChat ? (
            // Chat List View
            <>
              <div className={styles.chatHeader}>
                <h3>Messages</h3>
                <button
                  className={styles.closeButton}
                  onClick={() => setIsOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className={styles.chatListContainer}>
                {chatList.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>No conversations yet</p>
                    <small>Start chatting from product pages!</small>
                  </div>
                ) : (
                  chatList.map((chat, index) => (
                    <div
                      key={index}
                      className={styles.chatListItem}
                      onClick={() => openChat(chat)}
                    >
                      <img
                        src={chat.productImage}
                        alt=""
                        className={styles.chatListImage}
                      />
                      <div className={styles.chatListInfo}>
                        <div className={styles.chatListName}>
                          {chat.otherUserName}
                        </div>
                        <div className={styles.chatListProduct}>
                          {chat.productName}
                        </div>
                        <div className={styles.chatListMessage}>
                          {chat.lastMessage.substring(0, 40)}
                          {chat.lastMessage.length > 40 ? "..." : ""}
                        </div>
                      </div>
                      {chat.unreadCount > 0 && (
                        <span className={styles.unreadBadge}>
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            // Active Chat View
            <>
              <div className={styles.chatHeader}>
                <button className={styles.backButton} onClick={closeActiveChat}>
                  ←
                </button>
                <div className={styles.chatHeaderInfo}>
                  <h3>{activeChat.otherUserName}</h3>
                  <small>{activeChat.productName}</small>
                </div>
                <button
                  className={styles.closeButton}
                  onClick={() => setIsOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className={styles.messagesContainer}>
                {messages.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>No messages yet</p>
                    <small>Start the conversation!</small>
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`${styles.message} ${
                        msg.senderId._id === userId
                          ? styles.sent
                          : styles.received
                      }`}
                    >
                      <div className={styles.messageContent}>
                        {msg.message}
                      </div>
                      <div className={styles.messageTime}>
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <form className={styles.messageInput} onSubmit={handleSendMessage}>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button type="submit">➤</button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}

export default ChatWidget;
