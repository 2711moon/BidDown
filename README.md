# BID ON - Technical Documentation

## 1. Core Technology Stack

### Frontend (Client-Side)
*   **Core Library**: React (v19)
*   **Build Tool**: Vite (v8) - *For extremely fast hot-module replacement and optimized builds.*
*   **Routing**: React Router DOM (v7) - *Handles navigation between admin dashboards, vendor login, waiting rooms, and active bidding rooms.*
*   **Styling & UI**: 
    *   Tailwind CSS (v4) - *Utility-first CSS framework for rapid, responsive design.*
    *   Lucide React - *For crisp, modern SVG icons.*
*   **Real-time Communication**: Socket.io-client (v4.8) - *Listens for live bid updates, room closures, and participant changes without page refreshes.*
*   **Data Fetching**: Axios
*   **Data Exporting**:
    *   `xlsx` - *For generating Excel spreadsheet exports.*
    *   `jspdf` & `jspdf-autotable` - *For generating PDF reports.*
*   **Notifications**: React Hot Toast - *For non-intrusive success/error popups.*
*   **Linting**: Oxlint - *A fast Rust-based linter.*

### Backend (Server-Side)
*   **Runtime Engine**: Node.js
*   **Web Framework**: Express.js (v5) - *Handles RESTful API endpoints for authentication, creation, and data retrieval.*
*   **Database**: MongoDB
    *   **ORM/ODM**: Mongoose (v9.9) - *For schema definition and data validation.*
*   **Real-time Communication**: Socket.io (v4.8) - *The WebSockets server that pushes bid events instantly to connected clients.*
*   **Authentication & Security**:
    *   `bcrypt` (v6) - *For hashing admin and vendor access passwords securely.*
    *   `jsonwebtoken` (v9) - *For creating stateless admin authentication sessions.*
    *   `cors` - *To manage Cross-Origin Resource Sharing securely.*
*   **File Uploads & Storage**:
    *   `multer` & `multer-storage-cloudinary` - *For handling multipart form data (file uploads).*
    *   Cloudinary - *A cloud-based image/document storage service for hosting vendor KYC documents and product PDFs.*
*   **Email Services**:
    *   `nodemailer` (v9) - *Connected via Zoho SMTP (`smtp.zoho.in`) to send automated auction invites and access codes to vendors.*
*   **Task Scheduling**: `node-cron` - *For running background tasks (like closing auctions exactly when their end time hits).*

---

## 2. System Architecture

The application is built on a **Client-Server Architecture** utilizing a hybrid of REST APIs (for CRUD operations) and WebSockets (for live auction data).

### Backend Structure (MVC-ish Pattern)
*   **`/models`**: Mongoose schemas defining the structure of `Admin`, `Vendor`, `BidRoom`, `Product`, and `Bid`.
*   **`/controllers`**: Contains the business logic (e.g., `adminController.js`, `vendorController.js`). They receive HTTP requests, interact with models, and send JSON responses.
*   **`/routes`**: Maps HTTP methods (GET, POST, PUT, DELETE) and URL paths to specific controller functions.
*   **`/services`**: 
    *   `socketService.js`: The "brain" of the live auction. It handles rooms, broadcasts bids, and separates what data an Admin sees vs what a Vendor sees.
    *   `emailService.js`: Abstracts the Nodemailer logic for sending invites.

### Real-time Bidding Flow (WebSockets)
1.  **Connection**: When a user enters `/room/:id`, the frontend connects to the Socket.io server and emits a `joinRoom` event.
2.  **Role Separation**: The socket service categorizes connections into `adminSockets` and standard vendor rooms.
3.  **Bidding**: A vendor submits a bid (e.g., `placeBid`). The server validates it (checking base prices, time limits, and decrement values).
4.  **Emission**: 
    *   The server emits an `adminNewBid` event to the admin, containing the exact vendor's name and details.
    *   The server emits a `newLowestBid` event to all vendors, containing **only** the numerical bid amount (keeping competitors anonymous).

---

## 3. Security & Access Control

*   **Admin Access**: Secured via traditional Username/Password + JWT (JSON Web Tokens). The token is stored in local storage and sent in the `Authorization` header of API requests.
*   **Vendor Access (Time-Gated)**: 
    *   Vendors do not have global passwords. 
    *   When an admin creates an auction, the system generates a unique, random 5-character string for each invited vendor.
    *   These strings are hashed via `bcrypt` and saved to the database. The plain-text strings are emailed to the vendors via Nodemailer.
    *   If a vendor attempts to log in more than 5 minutes before the auction starts, the API rejects them (403 Forbidden). 
    *   If within 5 minutes, they are placed in a frontend "Waiting Room" (`WaitingRoom.jsx`) that counts down to zero before redirecting them to the live bidding floor.

---

## 4. Key Frontend Components

*   **`AdminDashboard.jsx`**: A heavy, state-driven component managing four sub-views (Dashboard Metrics, Live/Completed Auctions, Vendors, and Reports). Handles complex filtering, data formatting, and dynamic multi-select deletions.
*   **`AdminRoomView.jsx`**: The Admin's observer deck for a live auction. Features real-time countdowns, a live event log, a list of invited vendors (with connection status), and manual override controls (End Auction Early).
*   **`BiddingRoom.jsx`**: The Vendor's interface. Stripped down to show only the essential details: current lowest price (anonymous), product details, time remaining, and the input to place a lower bid.
