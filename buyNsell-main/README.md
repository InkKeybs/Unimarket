# Unimarket

Unimarket is a platform for students to explore, buy and sell used products within the campus.

The purpose of this project is to build connectivity within the campus where students can buy or sell used products from peers instead of relying on a third party producer/consumer.

- By building an internal marketplace, students can save on delivery fees and support the campus community.
- It enhances connectivity in the student community.
- It is often safer and more trustworthy for students to buy/sell from peers than from outsiders.

#### Tools

ReactJS, NodeJS, MongoDB, JWT web tokens, Mongoose

#### Turso SQL Setup (Migration Tooling)

The backend now includes Turso SQL schema + migration scripts.

- Add these env vars in `server/.env` (or Render env):
	- `TURSO_DATABASE_URL`
	- `TURSO_AUTH_TOKEN`
	- `ATLAS_KEY` (required when migrating existing Mongo data)
	- `DB_NAME` (optional Mongo db name)

- Initialize Turso schema:

```powershell
cd server
npm install
npm run db:init:turso
```

- Migrate MongoDB data to Turso:

```powershell
cd server
npm run db:migrate:mongo-to-turso
```

Notes:
- The migration copies users, products, bids (and bid entries), messages, OTPs, and token tables.
- Application query layer is still Mongoose-based; this tooling prepares and populates Turso for incremental endpoint migration.

#### Create a test account (seed)

To create a working test account in your MongoDB users collection, run the seed script included at `server/scripts/seedUser.js`.

- Create a `.env` at the project `server/` folder (or update it) with at minimum:
	- `ATLAS_KEY` — your MongoDB connection string
	- optional: `SALT` — bcrypt salt rounds (default 10)
	- optional: `SEED_USER_EMAIL`, `SEED_USER_PASSWORD`, `SEED_USER_NAME`, `SEED_USER_ADDRESS`, `SEED_USER_PHONE`, `SEED_USER_COURSE`

- Run the script from the project root (PowerShell):

```powershell
cd server
node scripts/seedUser.js
```

The script will create a verified user (if it doesn't already exist) and print the email/password to the console.


