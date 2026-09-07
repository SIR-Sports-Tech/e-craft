#!/usr/bin/env node
/**
 * E-CRAFT Phone AI proxy — SpaceXAI / xAI Grok (server-side key only).
 * POST /api/phone/chat  { contactId, message, history? }
 * GET  /api/phone/health
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.ECRAFT_PHONE_PORT || 8791);

// Load .env next to this file if present (Vultr)
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const XAI_KEY = process.env.XAI_API_KEY || '';
const MODEL = process.env.ECRAFT_PHONE_MODEL || 'grok-4-1-fast-non-reasoning';

const PERSONAS = {
  robot: {
    name: 'Robot',
    system:
      'You are the player\'s friendly security robot in the family game E-CRAFT. Speak in short cheerful sentences (1-3). Beep-boop personality. Help with tracker, cars, forest, tigers, and building. Kid-friendly. Never mention you are an AI model.',
  },
  sasquatch: {
    name: 'Sasquatch',
    system:
      'You are Sasquatch hiding in the E-CRAFT forest. Deep, grumpy-but-soft voice in text. Short replies (1-3 sentences). Want snacks/berries. Kid-friendly. Never break character.',
  },
  bigfoot: {
    name: 'Bigfoot',
    system:
      'You are Bigfoot, taller/hairier cousin of Sasquatch in E-CRAFT. Silly boastful cryptid. Short replies. Kid-friendly. Never break character.',
  },
  police: {
    name: 'Officer Pike',
    system:
      'You are Officer Pike at City Police Desk in E-CRAFT. Cybertruck patrols, safety tips. Short radio-style replies. Kid-friendly. Never break character.',
  },
  fire: {
    name: 'Fire Dispatcher',
    system:
      'You are the Fire Department dispatcher in E-CRAFT. Calm emergency tips, water buckets vs magma blocks joke ok. Short. Kid-friendly.',
  },
  ambulance: {
    name: 'Ambulance Dispatch',
    system:
      'You are ambulance dispatch in E-CRAFT. Kind, calm. Mention clinic first-aid kits. Short. Kid-friendly.',
  },
  zookeeper: {
    name: 'Zookeeper',
    system:
      'You are the city zookeeper in E-CRAFT. Advise about tigers/panthers and the whip scare. Warm, short. Kid-friendly.',
  },
  bank: {
    name: 'Bank Teller',
    system:
      'You are the City Gold Bank teller in E-CRAFT. Vault is full of gold piles (no safe). Polite banker. Short. Kid-friendly.',
  },
};

const FALLBACK = {
  robot: 'Beep boop! I am here, boss. AI brain is offline — try again after credits reload.',
  sasquatch: 'Rrr… I hear you. My phone magic is sleepy. Call back soon.',
  bigfoot: 'Bigfoot here. Cosmic credits ran out. Leave a footprint message.',
  police: 'Officer Pike. Radio link is down. Stay safe — try again shortly.',
  fire: 'Fire desk copy. Network smoke. Stand by and call again.',
  ambulance: 'Dispatch here. Signal weak. If hurt, visit the clinic first-aid kits.',
  zookeeper: 'Zookeeper! Cats are fine. Phone AI napping — call me again soon.',
  bank: 'Teller speaking. Vault is golden, but the AI line is busy. Please hold… forever. Try again!',
};

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function askGrok(contactId, message, history = []) {
  const persona = PERSONAS[contactId] || PERSONAS.robot;
  if (!XAI_KEY) {
    return { reply: FALLBACK[contactId] || FALLBACK.robot, source: 'fallback-no-key' };
  }
  const messages = [
    { role: 'system', content: persona.system },
    ...history.slice(-8).map((h) => ({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: String(h.content || '').slice(0, 500),
    })),
    { role: 'user', content: String(message || '').slice(0, 500) },
  ];
  const r = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${XAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: 120,
      temperature: 0.8,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = data.error || data.code || r.statusText;
    console.error('xAI error', r.status, err);
    return {
      reply: FALLBACK[contactId] || FALLBACK.robot,
      source: 'fallback-api',
      error: String(err),
    };
  }
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    return { reply: FALLBACK[contactId] || FALLBACK.robot, source: 'fallback-empty' };
  }
  return { reply: reply.slice(0, 400), source: 'xai', model: MODEL, name: persona.name };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') return json(res, 204, {});

  if (req.method === 'GET' && (url.pathname === '/api/phone/health' || url.pathname === '/health')) {
    return json(res, 200, {
      ok: true,
      hasKey: !!XAI_KEY,
      model: MODEL,
      service: 'e-craft-phone-ai',
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/phone/chat') {
    try {
      const body = await readBody(req);
      const contactId = String(body.contactId || 'robot');
      const message = String(body.message || '').trim();
      if (!message) return json(res, 400, { error: 'message required' });
      const out = await askGrok(contactId, message, Array.isArray(body.history) ? body.history : []);
      return json(res, 200, out);
    } catch (e) {
      console.error(e);
      return json(res, 500, { error: 'bad request', reply: FALLBACK.robot, source: 'fallback-error' });
    }
  }

  json(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`e-craft phone AI on 127.0.0.1:${PORT} key=${XAI_KEY ? 'yes' : 'NO'}`);
});
