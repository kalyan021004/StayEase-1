const jwt = require("jsonwebtoken");
const env = require("../config/env");

function signToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn, algorithm: "HS256" });
}

function verifyToken(token) {
  // Pin the algorithm so a token can't pick its own (e.g. "none").
  return jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
}

module.exports = { signToken, verifyToken };
