const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conexión a PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Necesario en Render
});

// Crear tabla de reservas si no existe
pool.query(`
  CREATE TABLE IF NOT EXISTS reservas(
    id SERIAL PRIMARY KEY,
    nombre TEXT,
    telefono TEXT,
    servicio TEXT,
    fecha DATE,
    hora TIME
  )
`).catch(err => console.error('Error creando tabla:', err));

// API para crear reserva
app.post('/api/reservas', async (req, res) => {
  const { nombre, telefono, servicio, fecha, hora } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO reservas(nombre, telefono, servicio, fecha, hora) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [nombre, telefono, servicio, fecha, hora]
    );
    res.json({ success: true, reserva: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});

// API para obtener reservas
app.get('/api/reservas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reservas ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
