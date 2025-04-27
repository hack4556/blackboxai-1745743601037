const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// MySQL connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // Set your MySQL root password here
  database: 'lapwater_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Helper function to create tables if not exist
async function initializeDatabase() {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL
    );
  `;

  const createSalesTable = `
    CREATE TABLE IF NOT EXISTS sales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      state VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL
    );
  `;

  const createDistributorsTable = `
    CREATE TABLE IF NOT EXISTS distributors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL
    );
  `;

  const createOrdersTable = `
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      distributor_id INT NOT NULL,
      product VARCHAR(255) NOT NULL,
      quantity INT NOT NULL,
      order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (distributor_id) REFERENCES distributors(id)
    );
  `;

  const connection = await pool.getConnection();
  try {
    await connection.query(createUsersTable);
    await connection.query(createSalesTable);
    await connection.query(createDistributorsTable);
    await connection.query(createOrdersTable);
  } finally {
    connection.release();
  }
}

// Initialize DB tables
initializeDatabase().catch(console.error);

// Routes

// Login route
app.post('/api/login', async (req, res) => {
  const { customerId, password } = req.body;
  if (!customerId || !password) {
    return res.status(400).json({ message: 'Customer ID and password are required' });
  }
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE customer_id = ?', [customerId]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid customer ID or password' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid customer ID or password' });
    }
    // For simplicity, no session or token is implemented here
    res.json({ message: 'Login successful' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Sales data route - returns total sales amount grouped by state
app.get('/api/sales', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT state, SUM(amount) as total_sales FROM sales GROUP BY state');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Distributor bulk order route
app.post('/api/distributor/order', async (req, res) => {
  const { distributorId, product, quantity } = req.body;
  if (!distributorId || !product || !quantity) {
    return res.status(400).json({ message: 'Distributor ID, product, and quantity are required' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO orders (distributor_id, product, quantity) VALUES (?, ?, ?)',
      [distributorId, product, quantity]
    );
    res.json({ message: 'Order placed successfully', orderId: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Serve dashboard pages
app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/distributor.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'distributor.html'));
});

// Start server
app.listen(port, () => {
  console.log("Server running on http://localhost:" + port);
});
