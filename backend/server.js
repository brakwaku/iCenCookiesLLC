import { ApolloServer } from "@apollo/server";
import { expressMiddleware as apolloExpress } from "@apollo/server/express4";
import cors from "cors";
import express from "express";
import { expressjwt } from "express-jwt";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";
import morgan from "morgan";
import fileupload from "express-fileupload";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize"; // Prevent NoSQL injections
import helmet from "helmet"; // Set security headers
import xss from "xss-clean"; // Prevent XSS attacks
import expressRateLimit from "express-rate-limit"; // Rate limiting of requests
import hpp from "hpp"; // Prevent HTTP param pollution
import errorHandler from "./middleware/error.js";
import connectDB from "./config/db.js";
import User from "./models/User.js";
import createproductLoader from "./loaders/productLoader.js";

// Import GraphQL schema and resolvers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.join(__dirname, "./graphql/schema.graphql");
import resolvers from "./graphql/resolvers.js";
const typeDefs = await readFile(schemaPath, "utf-8");

// Load env vars
dotenv.config({ path: "./config.env" });

// Connect to database
connectDB();

// Initialize Express app
const app = express();
const JWT_SECRET = Buffer.from("Zn8Q5tyZ/G1MHltc4F/gTkVJMlrbKiZt", "base64");

// Body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// Dev logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// File uploading
app.use(fileupload());

// Sanitize data
app.use(mongoSanitize());

// Set security headers
app.use(helmet());

// Prevent XSS attacks
app.use(xss());

// Rate limiting of requests
const limiter = expressRateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // 100 requests per 10 minutes
});
app.use(limiter);

// Prevent HTTP param pollution
app.use(hpp());

// Enable CORS
app.use(
  cors(),
  express.json(),
  expressjwt({
    algorithms: ["HS256"],
    credentialsRequired: false,
    secret: JWT_SECRET,
  })
);

// Set static folder
app.use(express.static(path.join(__dirname, "public")));
const context = async ({ req }) => {
  const { productLoader, reviewLoader } = createproductLoader();

  if (req.user) {
    try {
      const user = await User.findById(req.user.id);
      return {
        loaders: {
          productLoader,
          reviewLoader,
        },
        user,
      };
    } catch (error) {
      console.error("Error fetching user:", error);
      throw error;
    }
  }

  return { loaders: { productLoader, reviewLoader } };
};

// Set up Apollo Server with GraphQL schema and resolvers
const apolloServer = new ApolloServer({ typeDefs, resolvers });
await apolloServer.start();
app.use(
  "/graphql",
  // cors(),
  // express.json(),
  apolloExpress(apolloServer, { context })
);

app.use(errorHandler);

// Set up server port
const PORT = process.env.PORT || 4000;

// Start the server
app.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV} at http://localhost:${PORT}${apolloServer}`
  );
  console.log(`GraphQL server running at http://localhost:${PORT}/graphql`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  app.close(() => process.exit(1));
});
