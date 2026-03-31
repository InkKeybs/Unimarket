import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import styles from "./ChatWidget.module.scss";
import { useNavigate } from "react-router-dom";

const CHAT_IMAGE_MAX_DIMENSION = 1280;
const CHAT_IMAGE_TARGET_BYTES = 900 * 1024;
const CHAT_IMAGE_QUALITY_START = 0.82;
const CHAT_IMAGE_QUALITY_MIN = 0.55;

const getDataUrlByteSize = (dataUrl) => {
  if (typeof dataUrl !== "string") return 0;
  const parts = dataUrl.split(",");
  if (parts.length !== 2 || !parts[0].includes(";base64")) return 0;
  const base64Data = parts[1];
  const padding = (base64Data.match(/=*$/) || [""])[0].length;
  return Math.floor((base64Data.length * 3) / 4) - padding;
};

const loadImageFromDataUrl = (dataUrl) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });

const compressImageDataUrl = async (dataUrl) => {
  const img = await loadImageFromDataUrl(dataUrl);
  const canvas = document.createElement("canvas");

  let { width, height } = img;
  const largestSide = Math.max(width, height);
  if (largestSide > CHAT_IMAGE_MAX_DIMENSION) {
    const scale = CHAT_IMAGE_MAX_DIMENSION / largestSide;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to process image");
  }

  ctx.drawImage(img, 0, 0, width, height);

  let quality = CHAT_IMAGE_QUALITY_START;
  let compressedDataUrl = canvas.toDataURL("image/jpeg", quality);

  while (
    getDataUrlByteSize(compressedDataUrl) > CHAT_IMAGE_TARGET_BYTES &&
    quality > CHAT_IMAGE_QUALITY_MIN
  ) {
    quality -= 0.08;
    compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  return compressedDataUrl;
};

function ChatWidget() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState("");
  const [chatList, setChatList] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
  const [enlargedImage, setEnlargedImage] = useState("");
  const [unreadTotal, setUnreadTotal] = useState(0);
  const messagesEndRef = useRef(null);
  const quickReplies = [
    "Is this available?",
    "Can you share more photos?",
    "What is the last price?",
    "Where can we meet for pickup?",
  ];

  const resetChatState = () => {
    setIsAuthenticated(false);
    setUserId("");
    setChatList([]);
    setActiveChat(null);
    setMessages([]);
    setSelectedImage("");
    setEnlargedImage("");
    setIsOpen(false);
    setUnreadTotal(0);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const validateAuth = () => {
      let token = null;
      try {
        token = JSON.parse(localStorage.getItem("token"));
      } catch (err) {
        token = null;
      }

      if (!token || token === "") {
        resetChatState();
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
          setIsAuthenticated(true);
          if (myId !== userId) {
            setUserId(myId);
            setChatList([]);
            setActiveChat(null);
            setMessages([]);
          }
          loadChatList(myId);
        })
        .catch((error) => {
          console.log(error);
          resetChatState();
        });
    };

    validateAuth();

    const authCheckInterval = setInterval(validateAuth, 10000);
    window.addEventListener("focus", validateAuth);

    return () => {
      clearInterval(authCheckInterval);
      window.removeEventListener("focus", validateAuth);
    };
  }, [userId]);

  // Listen for external chat open events
  useEffect(() => {
    const handleOpenChat = (event) => {
      const { productId, otherUserId, productName, otherUserName, productImage } = event.detail;
      if (!userId || !isAuthenticated) return;
      
      setIsOpen(true);
      setActiveChat({
        productId,
        otherUserId,
        productName,
        otherUserName,
        productImage,
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

  const sendMessageText = (text, imagePayload = "") => {
    const cleanedMessage = (text || "").trim();
    const cleanedImage = imagePayload || "";
    if ((!cleanedMessage && !cleanedImage) || !activeChat) return;

    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/sendMessage",
      data: {
        productId: activeChat.productId,
        senderId: userId,
        receiverId: activeChat.otherUserId,
        message: cleanedMessage,
        imageData: cleanedImage || null,
      },
    })
      .then((res) => {
        setNewMessage("");
        setSelectedImage("");
        loadMessages(userId, activeChat.productId, activeChat.otherUserId);
        loadChatList(userId);
      })
      .catch((err) => {
        console.log(err);
        toast.error("Failed to send message");
      });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    sendMessageText(newMessage, selectedImage);
  };

  const handleImagePick = (e) => {
    const selectedFile = e.target.files && e.target.files[0];
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onload = async () => {
      try {
        const rawDataUrl = String(reader.result || "");
        const compressedDataUrl = await compressImageDataUrl(rawDataUrl);
        setSelectedImage(compressedDataUrl);
      } catch (error) {
        toast.error("Failed to compress selected image");
      }
      e.target.value = "";
    };
    reader.onerror = () => {
      toast.error("Failed to read selected image");
      e.target.value = "";
    };
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

  return (
    <>
      <div
        className={`${styles.chatLauncherBar} ${isOpen ? styles.open : ""}`}
        onClick={() => {
          if (!isAuthenticated) {
            navigate("/login");
            return;
          }
          setIsOpen(!isOpen);
        }}
      >
        <span className={styles.chatIcon}>💬</span>
        <span className={styles.chatLabel}>
          {isAuthenticated
            ? isOpen
              ? unreadTotal > 0
                ? `Close Chats (${unreadTotal})`
                : "Close Chats"
              : unreadTotal > 0
              ? `Open Chats (${unreadTotal})`
              : "Open Chats"
            : "Sign in to use chat"}
        </span>
        {isAuthenticated && unreadTotal > 0 && (
          <span className={styles.badge}>{unreadTotal}</span>
        )}
      </div>

      {/* Chat Widget */}
      {isAuthenticated && isOpen && (
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
                          {(chat.lastMessage || "").substring(0, 40)}
                          {(chat.lastMessage || "").length > 40 ? "..." : ""}
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
                  <div className={styles.headerProductMeta}>
                    {activeChat.productImage ? (
                      <img
                        src={activeChat.productImage}
                        alt={activeChat.productName || "product"}
                        className={styles.headerProductImage}
                      />
                    ) : null}
                    <small>{activeChat.productName || "Product chat"}</small>
                  </div>
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
                        msg.senderId?._id === userId
                          ? styles.sent
                          : styles.received
                      }`}
                    >
                      <div className={styles.messageContent}>
                        {msg.message ? <div>{msg.message}</div> : null}
                        {msg.imageData ? (
                          <img
                            src={msg.imageData}
                            alt="chat upload"
                            className={styles.messageImage}
                            onClick={() => setEnlargedImage(msg.imageData)}
                          />
                        ) : null}
                      </div>
                      <div className={styles.messageTime}>
                        {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ""}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className={styles.quickReplies}>
                {quickReplies.map((reply) => (
                  <button
                    key={reply}
                    type="button"
                    className={styles.quickReplyChip}
                    onClick={() => sendMessageText(reply, "")}
                  >
                    {reply}
                  </button>
                ))}
              </div>
              {selectedImage ? (
                <div className={styles.imagePreviewWrap}>
                  <img src={selectedImage} alt="selected chat upload" className={styles.imagePreview} />
                  <button
                    type="button"
                    className={styles.removePreviewBtn}
                    onClick={() => setSelectedImage("")}
                  >
                    Remove image
                  </button>
                </div>
              ) : null}
              <form className={styles.messageInput} onSubmit={handleSendMessage}>
                <label htmlFor="chatImageInput" className={styles.attachButton}>📎</label>
                <input
                  id="chatImageInput"
                  type="file"
                  accept="image/*"
                  className={styles.chatFileInput}
                  onChange={handleImagePick}
                />
                <span className={styles.attachHint}>Auto-compressed before send</span>
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
      {enlargedImage ? (
        <div
          className={styles.imageModalBackdrop}
          onClick={() => setEnlargedImage("")}
        >
          <img
            src={enlargedImage}
            alt="enlarged chat upload"
            className={styles.imageModalContent}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}

export default ChatWidget;
