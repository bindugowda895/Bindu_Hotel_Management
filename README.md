# Bindu Hotel Management

A beginner-friendly hotel management website built with:
- Node.js
- Express.js
- HTML, CSS and JavaScript
- SQLite database (`better-sqlite3`)

## Features
- Dashboard with room, booking, guest and estimated revenue counts
- Add and view hotel rooms
- Create guest bookings
- Prevent overlapping confirmed bookings for the same room
- View guest records
- Cancel bookings
- SQLite database is created automatically as `hotel.db`
- Sample rooms are inserted the first time the app starts

## Requirements
Install Node.js (LTS version) from https://nodejs.org/

## Run the project
1. Extract `Bindu_Hotel_Management.zip`.
2. Open the extracted `Bindu_Hotel_Management` folder in VS Code.
3. Open Terminal -> New Terminal.
4. Run:

   ```bash
   npm install
   ```

5. Start the server:

   ```bash
   npm start
   ```

6. Open this address in your browser:

   http://localhost:3000

## First test
- Open **Rooms** to see five sample rooms.
- Open **Bookings** and enter a guest name, phone number, room and dates.
- Open **Guests** to see the guest record.
- Return to **Dashboard** to see updated counts.

## Database
The SQLite file `hotel.db` is generated automatically in the project folder on first run. Keep this file to preserve your data. To reset the sample database, stop the server and delete `hotel.db`; it will be recreated the next time you run the app.

## Notes
This is a student/demo project. It does not include real payment processing, user login, or production-grade security. Do not enter real customer or payment information.
