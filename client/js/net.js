// Cliente WebSocket com pequeno emissor de eventos.
export const net = {
  ws: null, h: {},
  on(t, f) { (this.h[t] ||= []).push(f); },
  emit(t, d) { (this.h[t] || []).forEach(f => f(d)); },
  get open() { return this.ws && this.ws.readyState === 1; },
  connect() {
    if (this.open) return Promise.resolve();
    return new Promise((res, rej) => {
      const ws = this.ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
      ws.onopen = () => res(); ws.onerror = () => rej(new Error('Falha ao conectar'));
      ws.onmessage = e => { try { const m = JSON.parse(e.data); this.emit(m.t, m); } catch { } };
      ws.onclose = () => this.emit('close');
    });
  },
  send(o) { if (this.open) this.ws.send(JSON.stringify(o)); },
};
