PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mail TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  password TEXT,
  course TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  seller_verified INTEGER NOT NULL DEFAULT 0,
  seller_rating REAL NOT NULL DEFAULT 0,
  seller_rating_count INTEGER NOT NULL DEFAULT 0,
  verification_expires_at TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT,
  updated_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_mail ON users(mail);
CREATE INDEX IF NOT EXISTS idx_users_verified ON users(verified);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  pname TEXT NOT NULL,
  pprice REAL NOT NULL,
  pdetail TEXT,
  pcondition TEXT,
  pdate TEXT,
  pimage TEXT,
  pcat TEXT,
  preg TEXT,
  sold INTEGER NOT NULL DEFAULT 0,
  sold_to TEXT,
  sold_price REAL,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_at TEXT,
  approved_by TEXT,
  rejected_at TEXT,
  rejected_by TEXT,
  expires_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (seller_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_status_preg ON products(status, preg DESC);
CREATE INDEX IF NOT EXISTS idx_products_sold_status_preg ON products(sold, status, preg DESC);

CREATE TABLE IF NOT EXISTS bids (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  seller_id TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (seller_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bids_product_id ON bids(product_id);
CREATE INDEX IF NOT EXISTS idx_bids_seller_id ON bids(seller_id);

CREATE TABLE IF NOT EXISTS bid_entries (
  id TEXT PRIMARY KEY,
  bid_id TEXT NOT NULL,
  buyer_id TEXT,
  bid_price REAL,
  bid_time TEXT,
  regno TEXT,
  cancelled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (bid_id) REFERENCES bids(id),
  FOREIGN KEY (buyer_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_bid_entries_bid_id ON bid_entries(bid_id);
CREATE INDEX IF NOT EXISTS idx_bid_entries_buyer_id ON bid_entries(buyer_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  message TEXT NOT NULL,
  image_data TEXT,
  timestamp TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages(product_id, sender_id, receiver_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_read
  ON messages(receiver_id, is_read);

CREATE TABLE IF NOT EXISTS otps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0,
  purpose TEXT NOT NULL DEFAULT 'login',
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_otps_user_purpose ON otps(user_id, purpose);
CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps(expires_at);

CREATE TABLE IF NOT EXISTS verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL,
  created_at TEXT,
  expires_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_user_id ON verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);

CREATE TABLE IF NOT EXISTS user_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL,
  created_at TEXT,
  expires_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_token ON user_tokens(token);
