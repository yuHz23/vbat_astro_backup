var Database = require("better-sqlite3");
var db = new Database(".tmp/data.db");
var p = db.prepare("SELECT id, name, price, product_type, sub_category, status, sort_order FROM products WHERE sku = ?").get("TEST-10K");
console.log(p ? JSON.stringify(p) : "NOT FOUND");
db.close();
