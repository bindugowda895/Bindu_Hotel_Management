const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, "hotel.db"));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Create database tables automatically.
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_number TEXT NOT NULL UNIQUE,
    room_type TEXT NOT NULL,
    price REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Available'
  );

  CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,
    check_in TEXT NOT NULL,
    check_out TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Confirmed',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guest_id) REFERENCES guests(id),
    FOREIGN KEY (room_id) REFERENCES rooms(id)
  );
`);

const roomCount = db.prepare("SELECT COUNT(*) AS count FROM rooms").get().count;
if (roomCount === 0) {
  const insertRoom = db.prepare(
    "INSERT INTO rooms (room_number, room_type, price, status) VALUES (?, ?, ?, ?)"
  );
  const seed = db.transaction(() => {
    [
      ["101", "Single", 1200, "Available"],
      ["102", "Double", 1800, "Available"],
      ["103", "Deluxe", 2500, "Available"],
      ["201", "Suite", 4000, "Available"],
      ["202", "Deluxe", 2700, "Available"]
    ].forEach(room => insertRoom.run(...room));
  });
  seed();
}

const all = (sql, ...params) => db.prepare(sql).all(...params);
const get = (sql, ...params) => db.prepare(sql).get(...params);
const run = (sql, ...params) => db.prepare(sql).run(...params);

app.get("/api/dashboard", (req, res) => {
  const rooms = get("SELECT COUNT(*) AS total FROM rooms").total;
  const guests = get("SELECT COUNT(*) AS total FROM guests").total;
  const bookings = get("SELECT COUNT(*) AS total FROM bookings WHERE status = 'Confirmed'").total;
  const revenue = get(`
    SELECT COALESCE(SUM((julianday(check_out) - julianday(check_in)) * rooms.price), 0) AS total
    FROM bookings JOIN rooms ON bookings.room_id = rooms.id
    WHERE bookings.status = 'Confirmed'
  `).total;
  res.json({ rooms, guests, bookings, revenue: Math.round(revenue) });
});

app.get("/api/rooms", (req, res) => {
  res.json(all("SELECT * FROM rooms ORDER BY room_number"));
});

app.post("/api/rooms", (req, res) => {
  const { room_number, room_type, price } = req.body;
  if (!room_number || !room_type || !(Number(price) > 0)) {
    return res.status(400).json({ error: "Enter a room number, room type and valid price." });
  }
  try {
    const result = run(
      "INSERT INTO rooms (room_number, room_type, price) VALUES (?, ?, ?)",
      String(room_number).trim(), room_type, Number(price)
    );
    res.status(201).json(get("SELECT * FROM rooms WHERE id = ?", result.lastInsertRowid));
  } catch (error) {
    res.status(400).json({ error: "That room number already exists." });
  }
});

app.delete("/api/rooms/:id", (req, res) => {
  const room = get("SELECT * FROM rooms WHERE id = ?", Number(req.params.id));
  if (!room) return res.status(404).json({ error: "Room not found." });
  const used = get("SELECT COUNT(*) AS count FROM bookings WHERE room_id = ?", room.id).count;
  if (used) return res.status(400).json({ error: "This room has booking history and cannot be deleted." });
  run("DELETE FROM rooms WHERE id = ?", room.id);
  res.json({ message: "Room deleted." });
});

app.get("/api/guests", (req, res) => {
  res.json(all("SELECT * FROM guests ORDER BY id DESC"));
});

app.get("/api/bookings", (req, res) => {
  res.json(all(`
    SELECT bookings.id, guests.name AS guest_name, guests.phone,
           rooms.room_number, rooms.room_type, rooms.price,
           bookings.check_in, bookings.check_out, bookings.status
    FROM bookings
    JOIN guests ON bookings.guest_id = guests.id
    JOIN rooms ON bookings.room_id = rooms.id
    ORDER BY bookings.id DESC
  `));
});

app.post("/api/bookings", (req, res) => {
  const { guest_name, phone, email, room_id, check_in, check_out } = req.body;
  if (!guest_name || !phone || !room_id || !check_in || !check_out) {
    return res.status(400).json({ error: "Please complete all required booking fields." });
  }
  if (check_out <= check_in) {
    return res.status(400).json({ error: "Check-out date must be after check-in date." });
  }
  const room = get("SELECT * FROM rooms WHERE id = ?", Number(room_id));
  if (!room) return res.status(404).json({ error: "Selected room was not found." });

  const conflict = get(`
    SELECT COUNT(*) AS count FROM bookings
    WHERE room_id = ? AND status = 'Confirmed'
      AND NOT (check_out <= ? OR check_in >= ?)
  `, room.id, check_in, check_out).count;
  if (conflict) return res.status(400).json({ error: "This room is already booked for those dates." });

  const createBooking = db.transaction(() => {
    let guest = get("SELECT * FROM guests WHERE phone = ?", String(phone).trim());
    if (!guest) {
      const result = run(
        "INSERT INTO guests (name, phone, email) VALUES (?, ?, ?)",
        String(guest_name).trim(), String(phone).trim(), email || ""
      );
      guest = get("SELECT * FROM guests WHERE id = ?", result.lastInsertRowid);
    } else {
      run("UPDATE guests SET name = ?, email = ? WHERE id = ?",
        String(guest_name).trim(), email || "", guest.id);
    }
    const result = run(
      "INSERT INTO bookings (guest_id, room_id, check_in, check_out) VALUES (?, ?, ?, ?)",
      guest.id, room.id, check_in, check_out
    );
    return result.lastInsertRowid;
  });

  const id = createBooking();
  res.status(201).json(get(`
    SELECT bookings.id, guests.name AS guest_name, guests.phone,
           rooms.room_number, rooms.room_type, rooms.price,
           bookings.check_in, bookings.check_out, bookings.status
    FROM bookings JOIN guests ON bookings.guest_id = guests.id
    JOIN rooms ON bookings.room_id = rooms.id
    WHERE bookings.id = ?
  `, id));
});

app.patch("/api/bookings/:id/cancel", (req, res) => {
  const booking = get("SELECT * FROM bookings WHERE id = ?", Number(req.params.id));
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  run("UPDATE bookings SET status = 'Cancelled' WHERE id = ?", booking.id);
  res.json({ message: "Booking cancelled." });
});

app.listen(PORT, () => {
  console.log(`Bindu Hotel Management is running at http://localhost:${PORT}`);
});
