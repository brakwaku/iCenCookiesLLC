import jwt from "jsonwebtoken";
import asyncHandler from "./async.js";
// import ErrorResponse from "../utils/errorResponse.js";
import User from "../models/User.js";

// Protect routes
export const protect = asyncHandler(async (req) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.token) {
    // Set token from cookie
    token = req.cookies.token;
  }

  // Make sure token exists
  if (!token) {
    throw new Error("Not authorized to access this route");
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id);
  } catch (err) {
    throw new Error("Not authorized to access this route");
  }
});

// Grant access to specific roles
export const authorize = (role, user) => {
  if (role !== user.role) {
    throw new Error(
      `User role ${user.role} is not authorized to access this route`
    );
  }
};
