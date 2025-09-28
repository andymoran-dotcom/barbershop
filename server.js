// server.js

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

// Base de datos
const dbPath = path.join(__dirname, 'data');
const fs = require('fs');
if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath);

const db = new sqlite3.Database(path.join(dbPath, 'reservas.db'), (err) => {
  if (err) console.error(err.message);
  else console.log('Base de datos conectada.');
});

db.run(`CREATE TABLE IF NOT EXISTS reservas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  servicio TEXT NOT NULL,
  fecha TEXT NOT NULL,
  hora TEXT NOT NULL
)`);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Guardar reserva
app.post('/api/reservas', (req, res) => {
  const { nombre, telefono, servicio, fecha, hora } = req.body;
  db.run('INSERT INTO reservas (nombre, telefono, servicio, fecha, hora) VALUES (?, ?, ?, ?, ?)',
    [nombre, telefono, servicio, fecha, hora],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    });
});

// Panel admin seguro
app.get('/admin/reservas', (req, res) => {
  db.all('SELECT * FROM reservas ORDER BY fecha, hora', [], (err, rows) => {
    if (err) return res.status(500).send("Error al obtener reservas");

    // Escapar caracteres para HTML
    function escapeHtml(text) {
      if (!text) return '';
      return text.replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;")
                 .replace(/"/g, "&quot;")
                 .replace(/'/g, "&#039;");
    }

    let html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Panel de Reservas</title>
        <link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css">
        <style>
          body { font-family: Arial, sans-serif; background: #111; color: #eee; padding: 20px; }
          h1 { color: #ffd700; }
          button { padding: 6px 12px; margin: 2px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; }
          .edit { background: #ffd700; color: #000; }
          .delete { background: #e74c3c; color: #fff; }
          .export { background: #2ecc71; color: #fff; margin-bottom: 15px; }
          .modal { display: none; position: fixed; z-index: 1000; left:0; top:0; width:100%; height:100%; background: rgba(0,0,0,0.7); }
          .modal-content { background:#222; margin:10% auto; padding:20px; border:2px solid #ffd700; border-radius:12px; width:400px; color:#fff; }
          .modal h2 { margin-top:0; color:#ffd700; }
          .modal label { display:block; margin:10px 0 5px; }
          .modal input, .modal select { width:100%; padding:8px; border-radius:6px; border:none; margin-bottom:10px; }
          .modal .btn { width:48%; padding:10px; margin-top:10px; border-radius:6px; font-weight:bold; cursor:pointer; }
          .save { background:#ffd700; color:#000; }
          .cancel { background:#555; color:#fff; }
        </style>
      </head>
      <body>
        <h1>Reservas registradas</h1>
        <a href="/admin/exportar/csv" download><button class="export">📂 Exportar CSV</button></a>
        <a href="/admin/exportar/excel" download><button class="export">📊 Exportar Excel</button></a>
        <table id="tablaReservas" class="display">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Servicio</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>`;

    rows.forEach(r => {
      html += `<tr>
        <td>${r.id}</td>
        <td>${escapeHtml(r.nombre)}</td>
        <td>${escapeHtml(r.telefono)}</td>
        <td>${escapeHtml(r.servicio)}</td>
        <td>${escapeHtml(r.fecha)}</td>
        <td>${escapeHtml(r.hora)}</td>
        <td>
          <button class="edit" onclick="abrirModal(${r.id}, '${escapeHtml(r.nombre)}', '${escapeHtml(r.telefono)}', '${escapeHtml(r.servicio)}', '${r.fecha}', '${r.hora}')">Editar</button>
          <button class="delete" onclick="eliminar(${r.id})">Eliminar</button>
        </td>
      </tr>`;
    });

    html += `</tbody></table>

    <div id="modal" class="modal">
      <div class="modal-content">
        <h2>Editar reserva</h2>
        <form id="editForm">
          <input type="hidden" id="editId">
          <label>Nombre:</label><input type="text" id="editNombre" required>
          <label>Teléfono:</label><input type="text" id="editTelefono" required>
          <label>Servicio:</label>
          <select id="editServicio" required>
            <option value="corte">Corte de cabello</option>
            <option value="afeitado">Afeitado</option>
            <option value="barba">Arreglo de barba</option>
          </select>
          <label>Fecha:</label><input type="date" id="editFecha" required>
          <label>Hora:</label><input type="time" id="editHora" required>
          <div style="display:flex; justify-content:space-between;">
            <button type="button" class="btn save" onclick="guardarEdicion()">Guardar</button>
            <button type="button" class="btn cancel" onclick="cerrarModal()">Cancelar</button>
          </div>
        </form>
      </div>
    </div>

    <script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script>
      $(document).ready(function(){ $('#tablaReservas').DataTable({ pageLength:10 }); });

      function abrirModal(id,nombre,telefono,servicio,fecha,hora){
        document.getElementById('modal').style.display='block';
        document.getElementById('editId').value=id;
        document.getElementById('editNombre').value=nombre;
        document.getElementById('editTelefono').value=telefono;
        document.getElementById('editServicio').value=servicio;
        document.getElementById('editFecha').value=fecha;
        document.getElementById('editHora').value=hora;
      }
      function cerrarModal(){ document.getElementById('modal').style.display='none'; }
      async function guardarEdicion(){
        const id=document.getElementById('editId').value;
        const data={
          nombre: document.getElementById('editNombre').value,
          telefono: document.getElementById('editTelefono').value,
          servicio: document.getElementById('editServicio').value,
          fecha: document.getElementById('editFecha').value,
          hora: document.getElementById('editHora').value
        };
        const res=await fetch('/api/reservas/'+id,{ method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
        if(res.ok) location.reload();
      }
      async function eliminar(id){
        if(confirm('¿Seguro que quieres eliminar esta reserva?')){
          const res=await fetch('/api/reservas/'+id,{method:'DELETE'});
          if(res.ok) location.reload();
        }
      }
    </script>
    </body></html>`;

    res.send(html);
  });
});

// API eliminar reserva
app.delete('/api/reservas/:id',(req,res)=>{
  const {id}=req.params;
  db.run('DELETE FROM reservas WHERE id=?',[id],function(err){
    if(err) return res.status(500).json({error:err.message});
    res.json({success:true});
  });
});

// API editar reserva
app.put('/api/reservas/:id',(req,res)=>{
  const {id}=req.params;
  const {nombre,telefono,servicio,fecha,hora}=req.body;
  db.run('UPDATE reservas SET nombre=?,telefono=?,servicio=?,fecha=?,hora=? WHERE id=?',
    [nombre,telefono,servicio,fecha,hora,id],
    function(err){
      if(err) return res.status(500).json({error:err.message});
      res.json({success:true});
    });
});

// Exportar CSV
app.get('/admin/exportar/csv',(req,res)=>{
  db.all('SELECT * FROM reservas ORDER BY fecha,hora',[],(err,rows)=>{
    if(err) return res.status(500).send('Error al exportar CSV');
    let csv='ID,Nombre,Teléfono,Servicio,Fecha,Hora\n';
    rows.forEach(r=>{csv+=`${r.id},${r.nombre},${r.telefono},${r.servicio},${r.fecha},${r.hora}\n`;});
    res.setHeader('Content-disposition','attachment; filename=reservas.csv');
    res.set('Content-Type','text/csv');
    res.send(csv);
  });
});

// Exportar Excel
app.get('/admin/exportar/excel',(req,res)=>{
  db.all('SELECT * FROM reservas ORDER BY fecha,hora',[],(err,rows)=>{
    if(err) return res.status(500).send('Error al exportar Excel');
    const ws=XLSX.utils.json_to_sheet(rows);
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Reservas');
    const buffer=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
    res.setHeader('Content-disposition','attachment; filename=reservas.xlsx');
    res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  });
});

app.listen(PORT,()=>{console.log(`Servidor en http://localhost:${PORT}`);});