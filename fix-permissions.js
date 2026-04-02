var Database = require("better-sqlite3");
var db = new Database(".tmp/data.db");
var publicRole = db.prepare("SELECT id FROM up_roles WHERE type = 'public'").get();
var existing = db.prepare("SELECT p.action FROM up_permissions p JOIN up_permissions_role_lnk l ON p.id = l.permission_id WHERE l.role_id = ?").all(publicRole.id);
var existingActions = existing.map(function(e) { return e.action; });

var actions = [
  "api::order.order.paymentWebhook",
  "api::order.order.confirmTest",
  "api::order.order.checkStatus",
  "api::kyc.kyc.ocr",
  "api::kyc.kyc.manualSubmit"
];

actions.forEach(function(action) {
  if (existingActions.indexOf(action) === -1) {
    var result = db.prepare("INSERT INTO up_permissions (action, created_at, updated_at) VALUES (?, datetime('now'), datetime('now'))").run(action);
    db.prepare("INSERT INTO up_permissions_role_lnk (permission_id, role_id) VALUES (?, ?)").run(result.lastInsertRowid, publicRole.id);
    console.log("Added: " + action);
  } else {
    console.log("Exists: " + action);
  }
});

db.close();
console.log("Done");
