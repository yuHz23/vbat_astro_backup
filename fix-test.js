var Database = require("better-sqlite3");
var db = new Database(".tmp/data.db");
db.prepare("UPDATE products SET sort_order = 0 WHERE sku = ?").run("TEST-10K");
var p = db.prepare("SELECT id, name, sort_order, status FROM products WHERE sku = ?").get("TEST-10K");
console.log("Updated:", JSON.stringify(p));
db.close();
