const nodemailer = require('nodemailer');

// 📧 EMAIL BHEJNE WALA SYSTEM (Nodemailer Setup)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'codertech199@gmail.com', // 🚨 Yahan apna koi Gmail daalna
        pass: 'jdsb xpmt oasq hfdw'      // 🚨 Yahan Gmail ka 'App Password' aayega
    }
});

const axios = require('axios');
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg'); // NAYA: Database se connect karne ke liye

const app = express();
const PORT = 3000;

// Middleware setup
app.use(cors());
app.use(express.json());

// 🚨 YAHAN DHYAN DEIN: Apna PostgreSQL ka password yahan dalein
// 🚨 NAYA JADOO: Cloud Database Connection (Neon)
const pool = new Pool({
    // 👇 Neeche wali line mein single quotes (' ') ke andar apna lamba wala Neon link paste kar dena
    connectionString: 'postgresql://neondb_owner:npg_b7efyuR1aHAj@ep-polished-fog-ak71n56j-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ssl: {
        rejectUnauthorized: false // Cloud DB ke liye yeh zaroori hai
    }
});

// Database connection check karne ke liye
pool.connect()
    .then(() => console.log('📦 Database Connected Successfully!'))
    .catch(err => console.error('Database connection error:', err.stack));

// Multer setup images ko save karne ke liye
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, 'damage-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// API Route: Naya updated route jo DB mein data save karega
// 🚨 UPDATE KIYA HUA CODE: Ab complaint ke sath user ka naam bhi save hoga
// 🧠 NAYA JADOO: AI Auto-Routing System
// Yeh function automatically tay karega ki complaint kisko jayegi
function autoAssignDepartment(description, lat, lng) {
    let desc = (description || '').toLowerCase();
    
    // Rule 1: Agar details mein 'nh', 'highway', 'toll' ya 'expressway' hai -> NHAI
    if (desc.includes('nh') || desc.includes('highway') || desc.includes('toll')) {
        return 'NHAI';
    } 
    // Rule 2: Agar local city ka area hai jaise 'gali', 'colony', 'chowk', 'market' -> Municipal Corp
    else if (desc.includes('gali') || desc.includes('colony') || desc.includes('chowk') || desc.includes('market')) {
        return 'Municipal Corp';
    } 
    // Rule 3: Baaki sab main sadkein -> PWD
    else {
        return 'PWD';
    }
}

// 🧠 ULTIMATE JADOO: App -> Node.js -> Python AI -> Database
// 🚨 UPDATE 1: Nayi complaint aate hi Department ko Alert jayega
// 🚨 THE ULTIMATE FLOW: Nayi complaint aate hi Dept aur Admin DONO ko Email jayega
app.post('/api/report-damage', upload.single('roadImage'), async (req, res) => {
    const { latitude, longitude, description, reportedBy } = req.body;
    const imageUrl = req.file.path;
    
    // AI se Department assign hoga (Ya PWD default rakhna chaho toh rakh sakte ho)
    const assignedDept = autoAssignDepartment(description, latitude, longitude);
    let finalSeverity = 'Pending'; // 🚨 Ab user ko 'Pending' dikhega!

    try {
        const result = await pool.query(
            "INSERT INTO complaints (image_url, latitude, longitude, description, reported_by, assigned_to, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
            [imageUrl, latitude, longitude, description || 'No details', reportedBy || 'Unknown', assignedDept, finalSeverity]
        );
        
        const newCaseId = result.rows[0].id;
        console.log(`🚀 Naya Case #${newCaseId} Saved! | Dept: ${assignedDept}`);

        // ---------------------------------------------------------
        // 📧 DAAKIYA KA KAAM 1: DEPARTMENT KO ALERT BHEJO
        // ---------------------------------------------------------
        const deptUser = await pool.query("SELECT email FROM users WHERE role = 'Department' AND department = $1", [assignedDept]);
        if (deptUser.rows.length > 0) {
            transporter.sendMail({
                from: 'Smart Road System <tumhara.email@gmail.com>', 
                to: deptUser.rows[0].email,
                subject: `🚨 ALERT: Naya Kaam Assign Hua Hai (Case #${newCaseId})`,
                text: `Hello ${assignedDept} Team,\n\nEk nayi road damage report aayi hai.\n\nKripya theek karne ke baad portal par photo upload karein.\n\nRegards,\nAI System`
            });
        }

        // ---------------------------------------------------------
        // 📧 DAAKIYA KA KAAM 2: ADMIN KO BHI SAATH MEIN ALERT BHEJO
        // ---------------------------------------------------------
        const adminUser = await pool.query("SELECT email FROM users WHERE role = 'Admin'");
        if (adminUser.rows.length > 0) {
            transporter.sendMail({
                from: 'Smart Road System <tumhara.email@gmail.com>', 
                to: adminUser.rows[0].email,
                subject: `📋 ADMIN UPDATE: Naya Case #${newCaseId} Assign Hua`,
                text: `Hello Admin,\n\nEk nayi complaint aayi hai aur automatically ${assignedDept} ko assign kar di gayi hai.\n\nReported By: ${reportedBy}\n\nJab department kaam pura karega, aapko doosra alert aayega.\n\nRegards,\nAI System`
            });
            console.log(`✉️ Email sent to ${assignedDept} AND Admin!`);
        }

        res.status(200).json({ message: "Upload successful", id: newCaseId });
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "Data save nahi hua" });
    }
});

// NAYA CODE: Server ko permission dena ki map par photos dikha sake
app.use('/uploads', express.static('uploads'));


// 🚨 NAYA CODE: Gaddha theek hone (Resolve) ka status update karne ke liye API
// 🚨 UPDATE KIYA HUA CODE: Gaddha theek hote hi Email jayega
app.put('/api/complaints/:id/resolve', async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Pehle Gaddha 'Resolved' mark karo
        await pool.query("UPDATE complaints SET status = 'Resolved' WHERE id = $1", [id]);
        
        // 2. Ab check karo yeh gaddha kisne report kiya tha (Taaki uska email nikal sakein)
        const complaintData = await pool.query("SELECT reported_by, description FROM complaints WHERE id = $1", [id]);
        const userName = complaintData.rows[0].reported_by;
        const problemDetails = complaintData.rows[0].description;

        // 3. User Table se us insaan ka asli Email ID nikalo
        const userData = await pool.query("SELECT email FROM users WHERE full_name = $1", [userName]);
        
        // 4. Agar User ka Email mil gaya, toh usko turant Email bhej do! 🚀
        if (userData.rows.length > 0) {
            const userEmail = userData.rows[0].email;
            
            const mailOptions = {
                from: 'Smart Road AI Mission <tumhara.email@gmail.com>', // Yahan apna email rakhna
                to: userEmail,
                subject: `✅ Good News: Issue #${id} is Resolved!`,
                text: `Hello ${userName},\n\nAapne jo problem report ki thi:\n"${problemDetails}"\n\nWoh ab successfully PWD / NHAI dwara THEEK KAR DI GAYI HAI! 🛣️✨\n\nSmart Road Mission ka hissa banne ke liye dhanyawad.\n\nRegards,\nAI Command Center`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) { console.log("📧 Email bhejne mein error:", error); } 
                else { console.log("📧 Success! Email sent to:", userEmail); }
            });
        }

        res.status(200).json({ message: "Marked as resolved and Email trying to send!" });
    } catch (error) {
        console.error("Resolve error:", error);
        res.status(500).json({ error: "Resolve fail ho gaya" });
    }
});


// 🚨 NAYA CODE: Gaddha kisi Department ko Assign karne ki API
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

// 🚧 NAYA CODE: Department jab kaam poora karke nayi photo upload karega
// 🚨 UPDATE 2: Worker kaam karega toh Admin ko Alert jayega
app.post('/api/complaints/:id/work-done', upload.single('afterImage'), async (req, res) => {
    const { id } = req.params;
    const afterImageUrl = req.file.path;

    try {
        await pool.query("UPDATE complaints SET status = 'Verification Pending', after_image_url = $1 WHERE id = $2", [afterImageUrl, id]);
        console.log(`👷‍♂️ Case #${id}: Worker ne kaam kar diya!`);

        // 📧 DAAKIYA KA KAAM: Admin ko dhoondho aur Email bhejo
        const adminUser = await pool.query("SELECT email FROM users WHERE role = 'Admin'");
        if (adminUser.rows.length > 0) {
            transporter.sendMail({
                from: 'Smart Road AI Command <tumhara.email@gmail.com>',
                to: adminUser.rows[0].email,
                subject: `🧐 VERIFY: Case #${id} Kaam Pura Ho Gaya Hai!`,
                text: `Hello Admin,\n\nDepartment ne Case #${id} ka gaddha theek kar diya hai aur nayi photo upload kar di hai.\n\nKripya apne Admin Dashboard par jayein, 'Before & After' photo check karein, aur Resolve button dabayein.\n\nRegards,\nAI System`
            });
            console.log("✉️ Email sent to Admin for verification!");
        }

        res.status(200).json({ message: "Work submitted for verification!" });
    } catch (error) {
        console.error("Work update error:", error);
        res.status(500).json({ error: "Data save nahi hua" });
    }
});

// 🚨 NAYA CODE: User Signup (Naya account banana)
app.post('/api/signup', express.json(), async (req, res) => {
    const { fullName, email, password } = req.body;
    try {
        const result = await pool.query(
            "INSERT INTO users (full_name, email, password) VALUES ($1, $2, $3) RETURNING id, full_name",
            [fullName, email, password]
        );
        res.status(200).json({ message: "Account ban gaya!", user: result.rows[0] });
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ error: "Account nahi ban paya. Shayad email pehle se use hui hai." });
    }
});

// 🚨 NAYA CODE: User Login (Account mein ghusna)
// 🚨 NAYA SUPER LOGIN: Ab yeh Role aur Department bhi check karega
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



app.listen(PORT, () => {
    console.log(`🚀 Pro Backend Server is running on http://localhost:${PORT}`);
});



// 🧠 SMART FILTER API: Jiska jo role hai, usko wahi data milega
app.get('/api/smart-complaints', async (req, res) => {
    const { role, fullName, department } = req.query; // App se pata chalega kaun mang raha hai data
    
    try {
        let query = "";
        let params = [];

        if (role === 'Admin') {
            // Admin ko sab kuch dikhega
            query = "SELECT * FROM complaints ORDER BY id DESC";
        } else if (role === 'Department') {
            // PWD/NHAI ko sirf apna kaam dikhega
            query = "SELECT * FROM complaints WHERE assigned_to = $1 ORDER BY id DESC";
            params = [department];
        } else {
            // Citizen ko sirf apne report kiye gaddhe dikhenge
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