const mongoose = require("mongoose");

const AuditSchema = new mongoose.Schema({
  pdfId: String,
  originalHash: String,
  signedHash: String,
  fields: Array,
  signedAt: Date,
});

module.exports = mongoose.model("Audit", AuditSchema);