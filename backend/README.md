# Cotizador Backend

This is the backend part of the Cotizador project, built with Node.js and TypeScript. The backend serves as the API for the application, handling requests and responses.

## Project Structure

- **src/**: Contains the source code for the backend application.
  - **app.ts**: Entry point of the application, initializes the Express app and sets up middleware and routes.
  - **controllers/**: Contains the controllers for handling requests.
    - **index.ts**: Exports the `IndexController` class which handles requests to the root route.
  - **routes/**: Contains the route definitions for the application.
    - **index.ts**: Exports the `setRoutes` function to configure the application's routes.
  - **types/**: Contains TypeScript type definitions.
    - **index.ts**: Exports interfaces for `Request` and `Response`.

## Getting Started

1. **Installation**: 
   Run `npm install` to install the necessary dependencies.

2. **Running the Application**: 
   Use `npm start` to start the backend server.

3. **Testing**: 
   You can run tests using `npm test` if tests are set up.

## Dependencies

This project uses several npm packages, including Express for handling HTTP requests.

## License

This project is licensed under the MIT License.