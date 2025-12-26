# PDF Signature Editor

A simple full-stack app to place fields on a PDF and generate a signed version.

## Features

- Render a PDF in the browser
- Drag & resize fields on the document
- Supported fields:
  - Text
  - Date
  - Radio buttons
  - Image upload
  - Hand-drawn signature
- Fields stay correctly positioned across screen sizes
- Backend embeds all fields into the final PDF
- Generates a downloadable signed PDF

## Tech Stack

Frontend:
- React
- Tailwind CSS
- react-pdf
- Canvas (for signature)

Backend:
- Node.js
- Express
- pdf-lib
- MongoDB (audit logs)


cd backend
npm install
node index.js

cd frontend
npm install
npm run dev
