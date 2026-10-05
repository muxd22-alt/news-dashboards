import express from "express";
import { createServer } from "http";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import twilio from "twilio";
import admin from "firebase-admin";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      admin.initializeApp();
    }
  } catch (err) {
    console.error("Failed to initialize Firebase Admin:", err);
  }
}

function getTwilioClient() {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return null;
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const PORT = parseInt(process.env.APPLET_ID ? "3000" : (process.env.PORT || "3000"), 10);

  app.use(express.json());

  // --- Twilio Verify Routes ---
  
  app.post("/api/auth/send-otp", async (req, res) => {
    const { phone, checkExists } = req.body;
    
    // Check if user exists via Firebase Admin if requested
    if (checkExists) {
      if (!admin.apps.length) {
        return res.status(500).json({ error: "Firebase Admin is not configured." });
      }
      
      const localPhone = phone.replace('+966', '');
      const userEmail = `${localPhone}@auth.hudhudbot.ksa`;
      
      try {
        await admin.auth().getUserByEmail(userEmail);
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          return res.status(404).json({ error: "Phone number not registered" });
        }
        console.error("Firebase Admin Error:", err);
      }
    }

    const client = getTwilioClient();
    
    if (!client || !process.env.TWILIO_VERIFY_SERVICE_SID) {
      console.error("Twilio Config Missing", { 
        hasSid: !!process.env.TWILIO_ACCOUNT_SID, 
        hasToken: !!process.env.TWILIO_AUTH_TOKEN, 
        hasVerify: !!process.env.TWILIO_VERIFY_SERVICE_SID 
      });
      return res.status(500).json({ error: "Twilio not configured. Please check your AI Studio secrets." });
    }

    try {
      const verification = await client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID)
        .verifications
        .create({ to: phone, channel: 'sms' });
      
      res.json({ status: verification.status });
    } catch (error: any) {
      console.error("Twilio Send Error:", error);
      let errMsg = error.message || "Failed to send code";
      if (error.code === 60200) errMsg = "Invalid phone number detected by the carrier.";
      if (error.code === 60203) errMsg = "Max send attempts reached. Please try again later.";
      res.status(400).json({ error: errMsg });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    const { phone, code } = req.body;
    const client = getTwilioClient();
    
    if (!client || !process.env.TWILIO_VERIFY_SERVICE_SID) {
      return res.status(500).json({ error: "Twilio not configured" });
    }

    try {
      const verificationCheck = await client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID)
        .verificationChecks
        .create({ to: phone, code });
      
      res.json({ status: verificationCheck.status, valid: verificationCheck.valid });
    } catch (error: any) {
      console.error("Twilio Verify Error:", error);
      res.status(400).json({ error: error.message || "Verification failed" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { phone, code, newPassword } = req.body;
    const client = getTwilioClient();
    
    if (!client || !process.env.TWILIO_VERIFY_SERVICE_SID) {
      return res.status(500).json({ error: "Twilio not configured" });
    }

    try {
      const verificationCheck = await client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID)
        .verificationChecks
        .create({ to: phone, code });
      
      if (!verificationCheck.valid) {
        return res.status(400).json({ error: "Invalid code" });
      }

      if (!admin.apps.length) {
        return res.status(500).json({ error: "Firebase Admin is not configured." });
      }

      const localPhone = phone.replace('+966', '');
      const userEmail = `${localPhone}@auth.hudhudbot.ksa`;

      try {
        const userRecord = await admin.auth().getUserByEmail(userEmail);
        await admin.auth().updateUser(userRecord.uid, {
          password: newPassword
        });
        res.json({ success: true });
      } catch (firebaseErr: any) {
        console.error("Firebase Admin Error:", firebaseErr);
        res.status(400).json({ error: "User not found or unable to update password." });
      }
    } catch (error: any) {
      console.error("Password reset error:", error);
      res.status(400).json({ error: error.message || "Failed to reset password" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
// ... lines 122-137 ...
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    console.log("Serving static from:", distPath);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
