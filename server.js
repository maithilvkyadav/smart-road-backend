const nodemailer = require('nodemailer');
const axios = require('axios');
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg'); 

// 🚨 NAYA: Cloudinary Packages
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(cors());
app.use(express.json());

// 📧 EMAIL BHEJNE WALA SYSTEM (Nodemailer Setup)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'codertech199@gmail.com', 
        pass: 'jdsb xpmt oasq hfdw'      
    }
});

// ☁️ CLOUDINARY SETUP (🚨 BHAU, YAHAN APNI KEYS DAALNA MAT BHOOLNA)
cloudinary.config({ 
  cloud_name: 'Root', 
  api_key: '935532686615351', 
  api_secret: 'q2h9VkhCQJnRk8_hSY4B2u9cljE' 
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'SmartRoad_Uploads',
    allowed_formats: ['jpg', 'png', 'jpeg'],
  },
});
const upload = multer({ storage: storage });

// 🗄️ DATABASE CONNECTION (Neon Cloud)
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_b7efyuR1aHAj@ep-polished-fog-ak71n56j-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ssl: {
        rejectUnauthorized: false 
    }
});

pool.connect()
    .then(() => console.log('📦 Database Connected Successfully!'))
    .catch(err => console.error('Database connection error:', err.stack));


// 🧠 AI Auto-Routing System
function autoAssignDepartment(description, lat, lng) {
    let desc = (description || '').toLowerCase();
    if (desc.includes('nh') || desc.includes('highway') || desc.includes('toll')) {
        return 'NHAI';
    } else if (desc.includes('gali') || desc.includes('colony') || desc.includes('chowk') || desc.includes('market')) {
        return 'Municipal Corp';
    } else {
        return 'PWD';
    }
}

// -----------------------------------------------------------------
// 🚀 1. REPORT DAMAGE (CITIZEN UPLOAD) -> Ab Cloudinary par jayega
// -----------------------------------------------------------------
app.post('/api/report-damage', upload.single('roadImage'), async (req, res) => {
    const { latitude, longitude, description, reportedBy } = req.body;
    
    // 🚨 Cloudinary direct pura URL deta hai req.file.path mein
    const imageUrl = req.file.path; 
    
    const assignedDept = autoAssignDepartment(description, latitude, longitude);
    let finalSeverity = 'Pending'; 

    try {
        const result = await pool.query(
            "INSERT INTO complaints (image_url, latitude, longitude, description, reported_by, assigned_to, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
            [imageUrl, latitude, longitude, description || 'No details', reportedBy || 'Unknown', assignedDept, finalSeverity]
        );
        
        const newCaseId = result.rows[0].id;
        console.log(`🚀 Naya Case #${newCaseId} Saved! | Dept: ${assignedDept}`);

        // Email to Department
        const deptUser = await pool.query("SELECT email FROM users WHERE role = 'Department' AND department = $1", [assignedDept]);
        if (deptUser.rows.length > 0) {
            transporter.sendMail({
                from: 'Smart Road System <codertech199@gmail.com>', 
                to: deptUser.rows[0].email,
                subject: `🚨 ALERT: Naya Kaam Assign Hua Hai (Case #${newCaseId})`,
                text: `Hello ${assignedDept} Team,\n\nEk nayi road damage report aayi hai.\n\nKripya theek karne ke baad portal par photo upload karein.\n\nRegards,\nAI System`
            });
        }

        // Email to Admin
        const adminUser = await pool.query("SELECT email FROM users WHERE role = 'Admin'");
        if (adminUser.rows.length > 0) {
            transporter.sendMail({
                from: 'Smart Road System <codertech199@gmail.com>', 
                to: adminUser.rows[0].email,
                subject: `📋 ADMIN UPDATE: Naya Case #${newCaseId} Assign Hua`,
                text: `Hello Admin,\n\nEk nayi complaint aayi hai aur automatically ${assignedDept} ko assign kar di gayi hai.\n\nReported By: ${reportedBy}\n\nJab department kaam pura karega, aapko doosra alert aayega.\n\nRegards,\nAI System`
            });
        }

        res.status(200).json({ message: "Upload successful", id: newCaseId });
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "Data save nahi hua" });
    }
});

// -----------------------------------------------------------------
// 🗺️ 2. ADMIN DASHBOARD KE LIYE SARI COMPLAINTS BHEJNA (Missing tha!)
// -----------------------------------------------------------------
app.get('/api/complaints', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM complaints ORDER BY id DESC");
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Fetch error:", error);
        res.status(500).json({ error: "Data laane mein problem aayi" });
    }
});

// -----------------------------------------------------------------
// ✅ 3. RESOLVE COMPLAINT & SEND CONGRATS EMAIL
// -----------------------------------------------------------------
app.put('/api/complaints/:id/resolve', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query("UPDATE complaints SET status = 'Resolved' WHERE id = $1", [id]);
        
        const complaintData = await pool.query("SELECT reported_by, description FROM complaints WHERE id = $1", [id]);
        const userName = complaintData.rows[0].reported_by;
        const problemDetails = complaintData.rows[0].description;

        const userData = await pool.query("SELECT email FROM users WHERE full_name = $1", [userName]);
        
        if (userData.rows.length > 0) {
            const userEmail = userData.rows[0].email;
            const mailOptions = {
                from: 'Smart Road AI Mission <codertech199@gmail.com>', 
                to: userEmail,
                subject: `✅ Good News: Issue #${id} is Resolved!`,
                text: `Hello ${userName},\n\nAapne jo problem report ki thi:\n"${problemDetails}"\n\nWoh ab successfully PWD / NHAI dwara THEEK KAR DI GAYI HAI! 🛣️✨\n\nSmart Road Mission ka hissa banne ke liye dhanyawad.\n\nRegards,\nAI Command Center`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) { console.log("📧 Email error:", error); } 
                else { console.log("📧 Success! Email sent to:", userEmail); }
            });
        }

        res.status(200).json({ message: "Marked as resolved and Email trying to send!" });
    } catch (error) {
        console.error("Resolve error:", error);
        res.status(500).json({ error: "Resolve fail ho gaya" });
    }
});

// -----------------------------------------------------------------
// 📌 4. MANUAL ASSIGN DEPARTMENT
// -----------------------------------------------------------------
app.put('/api/complaints/:id/assign', express.json(), async (req, res) => {
    const { id } = req.params;
    const { department } = req.body;
    try {
        await pool.query("UPDATE complaints SET assigned_to = $1 WHERE id = $2", [department, id]);
        res.status(200).json({ message: "Assigned to " + department });
    } catch (error) {
        console.error("Assign error:", error);
        res.status(500).json({ error: "Assign fail ho gaya" });
    }
});

// -----------------------------------------------------------------
// 👷‍♂️ 5. DEPARTMENT WORK DONE (UPLOAD AFTER-IMAGE) -> Cloudinary
// -----------------------------------------------------------------
app.post('/api/complaints/:id/work-done', upload.single('afterImage'), async (req, res) => {
    const { id } = req.params;
    const afterImageUrl = req.file.path; // Cloudinary URL

    try {
        await pool.query("UPDATE complaints SET status = 'Verification Pending', after_image_url = $1 WHERE id = $2", [afterImageUrl, id]);
        console.log(`👷‍♂️ Case #${id}: Worker ne kaam kar diya!`);

        const adminUser = await pool.query("SELECT email FROM users WHERE role = 'Admin'");
        if (adminUser.rows.length > 0) {
            transporter.sendMail({
                from: 'Smart Road AI Command <codertech199@gmail.com>',
                to: adminUser.rows[0].email,
                subject: `🧐 VERIFY: Case #${id} Kaam Pura Ho Gaya Hai!`,
                text: `Hello Admin,\n\nDepartment ne Case #${id} ka gaddha theek kar diya hai aur nayi photo upload kar di hai.\n\nKripya apne Admin Dashboard par jayein, 'Before & After' photo check karein, aur Resolve button dabayein.\n\nRegards,\nAI System`
            });
        }

        res.status(200).json({ message: "Work submitted for verification!" });
    } catch (error) {
        console.error("Work update error:", error);
        res.status(500).json({ error: "Data save nahi hua" });
    }
});

// -----------------------------------------------------------------
// 📝 6. SMART SIGNUP (Naya Account Banane Ke Liye)
// -----------------------------------------------------------------
app.post('/api/signup', async (req, res) => {
  const { fullName, email, password } = req.body;
  
  try {
    const checkUser = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: "❌ Yeh Email pehle se register hai! Login karein." });
    }

    const newUser = await pool.query(
      "INSERT INTO users (full_name, email, password, role, department) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [fullName, email, password, 'Citizen', 'None']
    );

    res.status(200).json({ message: "✅ Account successfully ban gaya!", user: newUser.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "❌ Server Error! Database se connect nahi hua." });
  }
});

// -----------------------------------------------------------------
// 🔐 7. SUPER LOGIN (Role check ke sath)
// -----------------------------------------------------------------
app.post('/api/login', express.json(), async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(
            "SELECT id, full_name, email, role, department FROM users WHERE email = $1 AND password = $2",
            [email, password]
        );
        if (result.rows.length > 0) {
            console.log(`🔐 Login Success: ${result.rows[0].full_name} (${result.rows[0].role})`);
            res.status(200).json({ message: "Login successful!", user: result.rows[0] });
        } else {
            res.status(401).json({ error: "Email ya Password galat hai!" });
        }
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Server mein problem hai." });
    }
});

// -----------------------------------------------------------------
// 📱 8. APP SMART FILTER API (My Tracks ke liye)
// -----------------------------------------------------------------
app.get('/api/smart-complaints', async (req, res) => {
    const { role, fullName, department } = req.query; 
    try {
        let query = "";
        let params = [];

        if (role === 'Admin') {
            query = "SELECT * FROM complaints ORDER BY id DESC";
        } else if (role === 'Department') {
            query = "SELECT * FROM complaints WHERE assigned_to = $1 ORDER BY id DESC";
            params = [department];
        } else {
            query = "SELECT * FROM complaints WHERE reported_by = $1 ORDER BY id DESC";
            params = [fullName];
        }

        const result = await pool.query(query, params);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Fetch error:", error);
        res.status(500).json({ error: "Data laane mein problem aayi" });
    }
});

// -----------------------------------------------------------------
// 🚀 SERVER START KAREIN (Sabse end mein hona chahiye)
// -----------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`🚀 Pro Backend Server is running on http://localhost:${PORT}`);
});