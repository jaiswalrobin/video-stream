const dotenv = require("dotenv");
dotenv.config();

const app = require("./app.js");

const PORT = process.env.PORT || 80;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use`);
  } else {
    console.error("Failed to start server:", err);
  }
});