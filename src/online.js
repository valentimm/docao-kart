/** Room links. The host simulates the race and guests send what they press. */

import Peer from 'peerjs';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

const PEER_OPTS = {
  host: '0.peerjs.com',
  secure: true,
  port: 443,
  path: '/',
  debug: 0,
  config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
};

export function makeCode() {
  let code = '';
  for (let i = 0; i < 4; i += 1) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return code;
}

export function roomPeerId(code) {
  return `docao-${String(code || '').toLowerCase()}`;
}

export function normalizeCode(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8);
}

function wrapAngle(d) {
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function lerpAngle(a, b, t) {
  return a + wrapAngle(b - a) * t;
}

export function createOnline(handlers) {
  let peer = null;
  let role = null;
  let code = '';
  let guestConn = null;
  const links = new Map();

  function fail(error) {
    handlers.onError?.(error);
  }

  function drop() {
    for (const link of links.values()) link.close();
    links.clear();
    guestConn?.close();
    guestConn = null;
    peer?.destroy();
    peer = null;
    role = null;
  }

  function bindGuest(link) {
    guestConn = link;
    link.on('open', () => handlers.onReady?.());
    link.on('data', (msg) => handlers.onData?.('host', msg));
    link.on('close', () => handlers.onClosed?.());
    link.on('error', () => handlers.onClosed?.());
  }

  function bindHost(link) {
    const id = link.peer;
    links.set(id, link);
    link.on('data', (msg) => handlers.onData?.(id, msg));
    link.on('close', () => {
      links.delete(id);
      handlers.onLeave?.(id);
    });
    link.on('error', () => {
      links.delete(id);
      handlers.onLeave?.(id);
    });
  }

  return {
    get role() {
      return role;
    },
    get code() {
      return code;
    },
    get selfId() {
      return peer?.id || '';
    },
    host(nextCode) {
      drop();
      role = 'host';
      code = normalizeCode(nextCode);
      peer = new Peer(roomPeerId(code), PEER_OPTS);
      peer.on('open', () => handlers.onOpen?.());
      peer.on('connection', bindHost);
      peer.on('error', (error) => {
        if (error?.type === 'unavailable-id') fail(error);
        else fail(error);
      });
    },
    join(nextCode) {
      drop();
      role = 'guest';
      code = normalizeCode(nextCode);
      peer = new Peer(PEER_OPTS);
      peer.on('open', () => bindGuest(peer.connect(roomPeerId(code), { reliable: true })));
      peer.on('error', fail);
    },
    send(msg) {
      if (guestConn?.open) guestConn.send(msg);
    },
    sendTo(id, msg) {
      const link = links.get(id);
      if (link?.open) link.send(msg);
    },
    broadcast(msg) {
      for (const link of links.values()) {
        if (link.open) link.send(msg);
      }
    },
    leave() {
      if (role === 'host') {
        for (const link of links.values()) {
          if (link.open) link.send({ t: 'closed' });
        }
      } else if (guestConn?.open) {
        guestConn.send({ t: 'leave' });
      }
      drop();
    },
  };
}
