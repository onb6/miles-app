const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "For Miles API",
      version: "1.0.0",
      description: "API for the For Miles message board app",
    },
    servers: [
      { url: "https://www.olivialovesmiles.com", description: "Production" },
      { url: "http://localhost:3001", description: "Local" },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "session_token",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            username: { type: "string", example: "miles" },
            email: { type: "string", format: "email", example: "miles@example.com" },
          },
        },
        Message: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            content: { type: "string", example: "Hello!" },
            author: { type: "string", example: "miles" },
            user_id: { type: "integer", nullable: true, example: 1 },
            image_url: { type: "string", nullable: true, example: "/uploads/abc.jpg" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string", example: "Something went wrong" },
          },
        },
      },
    },
  },
  apis: ["./routes/*.js", "./index.js"],
};

module.exports = swaggerJsdoc(options);
