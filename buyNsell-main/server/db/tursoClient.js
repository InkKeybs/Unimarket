const { createClient } = require("@libsql/client");

const getTursoClient = () => {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (!url) {
    throw new Error("Missing TURSO_DATABASE_URL in environment variables");
  }

  const isLocalFileUrl = url.toLowerCase().startsWith("file:");

  if (!isLocalFileUrl && !authToken) {
    throw new Error(
      "Missing TURSO_AUTH_TOKEN for remote Turso database access"
    );
  }

  const clientConfig = { url };

  if (!isLocalFileUrl) {
    clientConfig.authToken = authToken;
  }

  return createClient(clientConfig);
};

module.exports = {
  getTursoClient,
};
