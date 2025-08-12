const express = require('express');
const cors = require('cors');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const app = express();
const port = 3000;

// Base de datos SQLite nativa
const db = new DatabaseSync('db.sqlite');

// Crear tablas si no existen
db.exec(`
  CREATE TABLE IF NOT EXISTS cliente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    telefono TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cita (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    servicio TEXT NOT NULL,
    fecha TEXT NOT NULL,
    hora TEXT NOT NULL,
    cortes_id INTEGER,
    FOREIGN KEY (cliente_id) REFERENCES cliente(id),
    FOREIGN KEY (cortes_id) REFERENCES cortes(id)
  );

  CREATE TABLE IF NOT EXISTS cortes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL
  );

  INSERT INTO cortes (nombre, tipo) VALUES
    -- DAMA
    ('Pixie', 'Dama'),
    ('Bob corto', 'Dama'),
    ('Garçon', 'Dama'),
    ('Bob largo (lob)', 'Dama'),
    ('Shag', 'Dama'),
    ('Midi recto', 'Dama'),
    ('Wolf cut', 'Dama'),
    ('Corte en capas medias', 'Dama'),
    ('Recto clásico', 'Dama'),
    ('En capas largas', 'Dama'),
    ('V-cut', 'Dama'),
    ('U-cut', 'Dama'),
    ('Corte desfilado', 'Dama'),
    ('Flequillo recto', 'Dama'),
    ('Flequillo de lado', 'Dama'),
    ('Flequillo cortina', 'Dama'),
    ('Baby bangs', 'Dama'),
    ('Asimétrico', 'Dama'),
    ('Corte point cut', 'Dama'),

    -- CABALLERO
    ('Buzz cut', 'Caballero'),
    ('Undercut', 'Caballero'),
    ('Mullet', 'Caballero'),
    ('Corte a navaja', 'Caballero'),
    ('Corte de precisión', 'Caballero'),
    ('Fade bajo', 'Caballero'),
    ('Fade medio', 'Caballero'),
    ('Fade alto', 'Caballero'),
    ('Pompadour', 'Caballero'),
    ('Crew cut', 'Caballero'),
    ('Corte clásico', 'Caballero'),
    ('Corte militar', 'Caballero'),
    ('Side part', 'Caballero'),
    ('French crop', 'Caballero'),

    -- NIÑO
    ('Corte escolar', 'Niño'),
    ('Corte en capas', 'Niño'),
    ('Peinado con raya lateral', 'Niño'),
    ('Degradado infantil', 'Niño'),
    ('Corte clásico infantil', 'Niño'),
    ('Spiky hair', 'Niño');
`);


app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));
app.get('/index.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.css'), {
    headers: {
      'Content-Type': 'text/css'
    }
  });
});
// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo salió mal!' });
});

// Endpoint para agendar una cita
app.post('/agendar', (req, res) => {
  try {
    const { nombre, telefono, servicio, fecha, hora, corte_id } = req.body;

    // Insertar cliente
    const insertCliente = db.prepare(`INSERT INTO cliente (nombre, telefono) VALUES (?, ?)`);
    const result = insertCliente.run(nombre, telefono);
    const cliente_id = result.lastInsertRowid;

    // Insertar cita (corregido - 5 parámetros)
    const insertCita = db.prepare(`INSERT INTO cita (cliente_id, servicio, fecha, hora, cortes_id) VALUES (?, ?, ?, ?, ?)`);
    insertCita.run(cliente_id, servicio, fecha, hora, corte_id);

    res.json({ mensaje: 'Cita agendada con éxito' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al agendar cita' });
  }
});

// Endpoint para ver citas
app.get('/citas', (req, res) => {
  try {
    const citas = db.prepare(`
      SELECT 
        c.id, 
        c.fecha, 
        c.hora, 
        cl.nombre, 
        cl.telefono, 
        c.servicio,
        c.cortes_id,
        co.nombre as nombre_corte,
        co.tipo as tipo_corte
      FROM cita c 
      JOIN cliente cl ON cl.id = c.cliente_id
      LEFT JOIN cortes co ON co.id = c.cortes_id
      ORDER BY c.fecha, c.hora
    `).all();
    
    // Formatear los datos para incluir siempre la información del corte
    const citasFormateadas = citas.map(c => ({
      ...c,
      corte_info: c.nombre_corte 
        ? `${c.nombre_corte} (${c.tipo_corte})` 
        : 'Sin corte especificado'
    }));
    
    res.json(citasFormateadas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener citas' });
  }
});

// Endpoint para obtener cortes
app.get('/cortes', (req, res) => {
  try {
    const cortes = db.prepare('SELECT * FROM cortes').all();
    res.json(cortes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener cortes' });
  }
});

// Endpoint para actualizar una cita
app.put('/citas/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, servicio, fecha, hora, corte_id } = req.body;

  // Obtener el cliente_id de la cita
  const cita = db.prepare('SELECT cliente_id FROM cita WHERE id = ?').get(id);
  if (!cita) {
    return res.status(404).json({ error: 'Cita no encontrada' });
  }

  // Actualizar cliente
  db.prepare('UPDATE cliente SET nombre = ?, telefono = ? WHERE id = ?')
    .run(nombre, telefono, cita.cliente_id);

  // Actualizar cita (incluyendo cortes_id)
  db.prepare('UPDATE cita SET servicio = ?, fecha = ?, hora = ?, cortes_id = ? WHERE id = ?')
    .run(servicio, fecha, hora, corte_id, id);

  res.json({ mensaje: 'Cita actualizada con éxito' });
});

// Endpoint para eliminar una cita
app.delete('/citas/:id', (req, res) => {
  const { id } = req.params;

  // Obtener el cliente_id de la cita
  const cita = db.prepare('SELECT cliente_id FROM cita WHERE id = ?').get(id);
  if (!cita) {
    return res.status(404).json({ error: 'Cita no encontrada' });
  }

  // Eliminar la cita
  db.prepare('DELETE FROM cita WHERE id = ?').run(id);

  // Eliminar el cliente si no tiene más citas
  const citasCliente = db.prepare('SELECT COUNT(*) as count FROM cita WHERE cliente_id = ?').get(cita.cliente_id);
  if (citasCliente.count === 0) {
    db.prepare('DELETE FROM cliente WHERE id = ?').run(cita.cliente_id);
  }

  res.json({ mensaje: 'Cita eliminada con éxito' });
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});