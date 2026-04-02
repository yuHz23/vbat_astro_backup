var Database = require("better-sqlite3");
var db = new Database(".tmp/data.db");

// Show all pending orders
var orders = db.prepare("SELECT order_number, status, total_amount FROM orders WHERE status = 'pending' ORDER BY created_at DESC").all();
console.log("Pending orders:");
orders.forEach(function(o) { console.log(o.order_number + " | " + o.status + " | " + o.total_amount); });

// Confirm all pending orders as paid
var result = db.prepare("UPDATE orders SET status = 'paid' WHERE status = 'pending'").run();
console.log("Confirmed " + result.changes + " orders as paid");

db.close();
