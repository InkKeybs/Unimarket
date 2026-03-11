// Function to open chat widget with specific product/user
// Call this from anywhere: window.openChatWidget(productId, otherUserId, productName, otherUserName)
window.openChatWidget = function(productId, otherUserId, productName, otherUserName) {
  window.dispatchEvent(new CustomEvent('openChat', {
    detail: { productId, otherUserId, productName, otherUserName }
  }));
};
