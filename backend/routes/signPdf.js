const express = require("express");
const router = express.Router();

const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");

const { sha256 } = require("../utils/hash");
const Audit = require("../models/audit");

const BASE_URL = "https://signature-editor.onrender.com" || "http://localhost:5001";

router.post("/", async (req, res) => {
  try {
    console.log("Received payload:", req.body);

    const { pdfId, fields } = req.body;

    // Load original PDF
    const pdfPath = path.join(
      __dirname,
      "..",
      "uploads",
      "original",
      pdfId
    );
    const existingPdfBytes = fs.readFileSync(pdfPath);
    const originalHash = sha256(existingPdfBytes);

    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();

    for (const field of fields) {
      const { type, xRatio, yRatio, widthRatio, heightRatio, value } = field;

      if (
        xRatio == null ||
        yRatio == null ||
        widthRatio == null ||
        heightRatio == null
      ) {
        continue;
      }

      const boxWidth = widthRatio * width;
      const boxHeight = heightRatio * height;

      if (boxWidth <= 0 || boxHeight <= 0) continue;

      const x = xRatio * width;
      const y = height - yRatio * height - boxHeight;

      if (type === "text" || type === "date" || type === "radio") {
        if (!value) continue;

        const fontSize = 12;
        page.drawText(String(value), {
          x: x + 4,
          y: y + boxHeight / 2 - fontSize / 2,
          size: fontSize,
        });
      }

      if (type === "image" || type === "signature") {
        if (!value) continue;

        if (
          !value.startsWith("data:image/png;base64,") &&
          !value.startsWith("data:image/jpeg;base64,")
        ) {
          throw new Error(`${type} must be PNG or JPG Base64`);
        }

        const base64Data = value.split(",")[1];
        const imageBytes = Buffer.from(base64Data, "base64");

        const image =
          value.startsWith("data:image/jpeg")
            ? await pdfDoc.embedJpg(imageBytes)
            : await pdfDoc.embedPng(imageBytes);

        const imageDims = image.scale(1);

        const scale = Math.min(
          boxWidth / imageDims.width,
          boxHeight / imageDims.height
        );

        const drawWidth = imageDims.width * scale;
        const drawHeight = imageDims.height * scale;

        const centeredX = x + (boxWidth - drawWidth) / 2;
        const centeredY = y + (boxHeight - drawHeight) / 2;

        page.drawImage(image, {
          x: centeredX,
          y: centeredY,
          width: drawWidth,
          height: drawHeight,
        });
      }
    }

    // Save signed PDF
    const signedPdfBytes = await pdfDoc.save();
    const signedHash = sha256(signedPdfBytes);
    const signedPath = path.join(
      __dirname,
      "..",
      "uploads",
      "signed",
      `signed-${pdfId}`
    );

    const signedDir = path.join(__dirname, "..", "uploads", "signed");
    if (!fs.existsSync(signedDir)) {
      fs.mkdirSync(signedDir, { recursive: true });
    }

    fs.writeFileSync(signedPath, signedPdfBytes);

    // Store audit trail before responding
    try {
      await Audit.create({
        pdfId,
        originalHash,
        signedHash,
        fields,
        signedAt: new Date(),
      });
    } catch (dbErr) {
      console.error("AUDIT LOG FAILED:", dbErr.message);
    }

    // Respond with URL
    res.json({
  success: true,
  signedPdfUrl: `${BASE_URL}/uploads/signed/signed-${pdfId}`,
});
  } catch (err) {
    console.error("SIGN PDF ERROR:", err);
    res.status(500).json({
      error: err.message,
    });
  }
});

module.exports = router;