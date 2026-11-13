import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const cases = JSON.parse(readFileSync(join(__dirname, 'data', 'cases.json'), 'utf8'));
const caseById = new Map(cases.cases.map(c => [c.id, c]));

app.use(express.static(join(__dirname, 'public')));

app.get('/api/cases', (_req, res) => {
  res.json(cases.cases.map(c => ({ id: c.id, title: c.title, summary: c.summary })));
});

app.get('/api/cases/:id', (req, res) => {
  const c = caseById.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });
  res.json(c);
});

const rooms = new Map();

function roomState(roomId) {
  const r = rooms.get(roomId);
  if (!r) return null;
  return {
    caseId: r.caseId,
    present: { A: !!r.clients.A, B: !!r.clients.B },
    discussed: [...r.discussed],
    answers: r.answers
  };
}

function broadcast(roomId) {
  const r = rooms.get(roomId);
  if (!r) return;
  const state = roomState(roomId);
  const msg = JSON.stringify({ type: 'state', state });
  for (const role of ['A', 'B']) {
    const ws = r.clients[role];
    if (ws && ws.readyState === 1) ws.send(msg);
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const roomId = url.searchParams.get('room');
  const role = url.searchParams.get('role');
  const caseId = url.searchParams.get('case');

  if (!roomId || !role || !['A', 'B'].includes(role)) {
    ws.close(1008, 'bad params');
    return;
  }

  let r = rooms.get(roomId);
  if (!r) {
    if (!caseId || !caseById.has(caseId)) {
      ws.close(1008, 'bad case');
      return;
    }
    r = {
      caseId,
      clients: { A: null, B: null },
      discussed: new Set(),
      answers: { A: {}, B: {} }
    };
    rooms.set(roomId, r);
  }

  const prev = r.clients[role];
  r.clients[role] = ws;
  if (prev && prev !== ws && prev.readyState === 1) {
    try { prev.close(1000, 'replaced'); } catch {}
  }

  broadcast(roomId);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const rr = rooms.get(roomId);
    if (!rr) return;

    if (msg.type === 'toggle-discuss') {
      const id = String(msg.pairId || '');
      if (!id) return;
      if (rr.discussed.has(id)) rr.discussed.delete(id);
      else rr.discussed.add(id);
      broadcast(roomId);
    } else if (msg.type === 'answer') {
      const qi = Number(msg.qIndex);
      if (!Number.isInteger(qi) || qi < 0) return;
      rr.answers[role][qi] = String(msg.text ?? '').slice(0, 500);
      broadcast(roomId);
    }
  });

  ws.on('close', () => {
    const rr = rooms.get(roomId);
    if (rr && rr.clients[role] === ws) {
      rr.clients[role] = null;
      broadcast(roomId);
      if (!rr.clients.A && !rr.clients.B) {
        setTimeout(() => {
          const r2 = rooms.get(roomId);
          if (r2 && !r2.clients.A && !r2.clients.B) rooms.delete(roomId);
        }, 60 * 60 * 1000);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Co-op Case Room: http://localhost:${PORT}`);
});