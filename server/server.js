import { ApolloServer } from "@apollo/server";
import { expressMiddleware as apolloMiddleware } from "@apollo/server/express4";
import cors from "cors";
import express from "express";
import { expressjwt } from "express-jwt";
import { readFile } from "node:fs/promises";
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
import resolvers from "./graphql/resolvers.js";

// Route files
// import auth from "./routes/auth.js";
// import users from "./routes/users.js";

// Load env vars
dotenv.config({ path: "./config.env" });

// Connect to database
connectDB();

// Initialize Express app
const app = express();

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
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  // Allows the use of the apollo sandbox
  contentSecurityPolicy: {
    directives: {
      imgSrc: [`'self'`, 'data:', 'apollo-server-landing-page.cdn.apollographql.com'],
      scriptSrc: [`'self'`, `https: 'unsafe-inline'`],
      manifestSrc: [`'self'`, 'apollo-server-landing-page.cdn.apollographql.com'],
      frameSrc: [`'self'`, 'sandbox.embed.apollographql.com'],
    },
  },
}));

// Prevent XSS attacks
app.use(xss());

// Rate limiting of requests
const limiter = expressRateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // 100 requests per 10 minutes
});
// app.use(limiter);

// Prevent HTTP param pollution
app.use(hpp());

app.use(
  cors(), // Enable CORS
  express.json(), // Body parser
  // expressjwt({
  //   algorithms: ["HS256"],
  //   credentialsRequired: false,
  //   secret: process.env.JWT_SECRET,
  // })
);

// Import GraphQL schema
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.join(__dirname, "./graphql/schema.graphql");
const typeDefs = await readFile(schemaPath, "utf-8");

// Set static folder
app.use(express.static(path.join(__dirname, "public")));
const context = async ({ req, res }) => {
  console.log("*******************REQ: ", req.auth, req.user, req.cookies);
  const { productLoader, reviewLoader } = createproductLoader();

  if (req.auth) {
    try {
      const user = await User.findById(req.auth.id);
      return {
        loaders: {
          productLoader,
          reviewLoader,
        },
        user,
        res,
        req,
        next: req.next
      };
    } catch (error) {
      console.error("Error fetching user:", error);
      throw error;
    }
  }

  return { loaders: { productLoader, reviewLoader }, res, req, next: req.next };
};

// Set up Apollo Server with GraphQL schema and resolvers
const apolloServer = new ApolloServer({ typeDefs, resolvers });
await apolloServer.start();
app.use(
  "/graphql",
  cors(),
  express.json(),
  apolloMiddleware(apolloServer, { context })
);

// Mount routers
// app.use('/api/v1/auth', auth);
// app.use('/api/v1/users', users);
// app.use('/api/v1/bootcamps', bootcamps);
// app.use('/api/v1/courses', courses);
// app.use('/api/v1/reviews', reviews);

app.use(errorHandler);

// Set up server port
const PORT = process.env.PORT || 4000;

if (process.env.NODE_ENV === 'production') { // For deployment purposes
  app.use(express.static(path.join(__dirname, '/client/build')));

  app.get('*', (req, res) => res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html')));
} else {
  app.get('/', (req, res) => {
      res.send('API is running...');
  })
}

// Start the server
app.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV} at http://localhost:${PORT}`
  );
  console.log(`GraphQL server running at http://localhost:${PORT}/graphql`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  app.close(() => process.exit(1));
});
