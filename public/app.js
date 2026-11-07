const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function showView(name) {
  $$(".view").forEach(view => view.classList.add("hidden"));
  $(`#${name}-view`).classList.remove("hidden");
  $$(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.view === name));
  $("#page-title").textContent = name[0].toUpperCase() + name.slice(1);
  if (name === "dashboard") loadDashboard();
  if (name === "rooms") loadRooms();
  if (name === "bookings") { loadRooms(); loadBookings(); }
  if (name === "guests") loadGuests();
}

$$(".nav-link").forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));
$$(".quick-card").forEach(button => button.addEventListener("click", () => showView(button.dataset.go)));

async function loadDashboard() {
  try {
    const data = await api("/api/dashboard");
    $("#stat-rooms").textContent = data.rooms;
    $("#stat-bookings").textContent = data.bookings;
    $("#stat-guests").textContent = data.guests;
    $("#stat-revenue").textContent = "₹" + Number(data.revenue).toLocaleString("en-IN");
  } catch (error) { toast(error.message); }
}

async function loadRooms() {
  try {
    const rooms = await api("/api/rooms");
    $("#room-count").textContent = `${rooms.length} rooms`;
    $("#rooms-table").innerHTML = rooms.length ? rooms.map(room => `
      <tr>
        <td><strong>${escapeHtml(room.room_number)}</strong></td>
        <td>${escapeHtml(room.room_type)}</td>
        <td>₹${Number(room.price).toLocaleString("en-IN")}</td>
        <td><span class="status">${escapeHtml(room.status)}</span></td>
        <td><button class="action-btn" data-delete-room="${room.id}">Delete</button></td>
      </tr>`).join("") : emptyRow(5, "No rooms added yet.");
    $("#booking-room").innerHTML = rooms.length
      ? rooms.map(room => `<option value="${room.id}">Room ${escapeHtml(room.room_number)} · ${escapeHtml(room.room_type)} · ₹${room.price}/night</option>`).join("")
      : `<option value="">Add a room first</option>`;
  } catch (error) { toast(error.message); }
}

async function loadBookings() {
  try {
    const bookings = await api("/api/bookings");
    $("#booking-count").textContent = `${bookings.length} bookings`;
    $("#bookings-table").innerHTML = bookings.length ? bookings.map(item => `
      <tr>
        <td><strong>${escapeHtml(item.guest_name)}</strong><br><small>${escapeHtml(item.phone)}</small></td>
        <td>${escapeHtml(item.room_number)} · ${escapeHtml(item.room_type)}</td>
        <td>${escapeHtml(item.check_in)}</td>
        <td>${escapeHtml(item.check_out)}</td>
        <td><span class="status ${item.status === "Cancelled" ? "cancelled" : ""}">${escapeHtml(item.status)}</span></td>
        <td>${item.status === "Confirmed" ? `<button class="action-btn" data-cancel-booking="${item.id}">Cancel</button>` : "—"}</td>
      </tr>`).join("") : emptyRow(6, "No bookings yet.");
  } catch (error) { toast(error.message); }
}

async function loadGuests() {
  try {
    const guests = await api("/api/guests");
    $("#guest-count").textContent = `${guests.length} guests`;
    $("#guests-table").innerHTML = guests.length ? guests.map(guest => `
      <tr><td><strong>${escapeHtml(guest.name)}</strong></td><td>${escapeHtml(guest.phone)}</td><td>${escapeHtml(guest.email || "—")}</td></tr>
    `).join("") : emptyRow(3, "No guests registered yet.");
  } catch (error) { toast(error.message); }
}

function emptyRow(columns, message) {
  return `<tr><td class="empty" colspan="${columns}">${message}</td></tr>`;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

$("#room-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = new FormData(event.target);
  const body = Object.fromEntries(form.entries());
  try {
    await api("/api/rooms", { method: "POST", body: JSON.stringify(body) });
    event.target.reset();
    toast("Room added successfully.");
    loadRooms(); loadDashboard();
  } catch (error) { toast(error.message); }
});

$("#booking-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = new FormData(event.target);
  const body = Object.fromEntries(form.entries());
  try {
    await api("/api/bookings", { method: "POST", body: JSON.stringify(body) });
    event.target.reset();
    toast("Booking confirmed successfully.");
    loadBookings(); loadGuests(); loadDashboard();
  } catch (error) { toast(error.message); }
});

document.addEventListener("click", async event => {
  const roomButton = event.target.closest("[data-delete-room]");
  const cancelButton = event.target.closest("[data-cancel-booking]");
  if (roomButton && confirm("Delete this room?")) {
    try {
      await api(`/api/rooms/${roomButton.dataset.deleteRoom}`, { method: "DELETE" });
      toast("Room deleted."); loadRooms(); loadDashboard();
    } catch (error) { toast(error.message); }
  }
  if (cancelButton && confirm("Cancel this booking?")) {
    try {
      await api(`/api/bookings/${cancelButton.dataset.cancelBooking}/cancel`, { method: "PATCH" });
      toast("Booking cancelled."); loadBookings(); loadDashboard();
    } catch (error) { toast(error.message); }
  }
});

$("#year").textContent = new Date().getFullYear();
loadDashboard();
