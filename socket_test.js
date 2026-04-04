// Add this route to your server.js before the socket section
// app.get('/test', (req, res) => { res.send(SOCKET_TEST_HTML) })

const SOCKET_TEST_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Socket Tester</title>
  <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: monospace; background: #0f172a; color: #e2e8f0; padding: 24px; }
    h2  { color: #38bdf8; margin-bottom: 16px; }

    .row   { display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
    input  { flex: 1; min-width: 200px; background: #1e293b; border: 1px solid #334155;
             color: #f1f5f9; padding: 8px 12px; border-radius: 6px; font-family: monospace; }
    button { background: #2563eb; color: #fff; border: none; padding: 8px 18px;
             border-radius: 6px; cursor: pointer; font-size: 13px; }
    button:hover   { background: #1d4ed8; }
    button.red     { background: #dc2626; }
    button.green   { background: #16a34a; }
    button.orange  { background: #d97706; }

    .section { background: #1e293b; border-radius: 10px; padding: 16px;
               margin-bottom: 16px; border: 1px solid #334155; }
    .section h3 { color: #94a3b8; font-size: 12px; text-transform: uppercase;
                  letter-spacing: .08em; margin-bottom: 12px; }

    #log  { background: #020617; border-radius: 8px; padding: 14px;
            height: 320px; overflow-y: auto; font-size: 12px; line-height: 1.8; }
    .ok   { color: #4ade80; }
    .err  { color: #f87171; }
    .in   { color: #818cf8; }
    .out  { color: #fb923c; }
    .info { color: #94a3b8; }

    #status { display: inline-block; width: 10px; height: 10px; border-radius: 50%;
              background: #ef4444; margin-right: 6px; }
    #status.on { background: #22c55e; }
  </style>
</head>
<body>
  <h2>🔌 Socket.IO Tester</h2>

  <!-- Connect -->
  <div class="section">
    <h3>1 — Connect</h3>
    <div class="row">
      <input id="token"  placeholder="Paste your Laravel Bearer token here" />
    </div>
    <div class="row">
      <button class="green" onclick="connectSocket()">Connect</button>
      <button class="red"   onclick="disconnectSocket()">Disconnect</button>
      <span style="line-height:36px">
        <span id="status"></span><span id="statusText">Disconnected</span>
      </span>
    </div>
  </div>

  <!-- Join room -->
  <div class="section">
    <h3>2 — Join Conversation Room</h3>
    <div class="row">
      <input id="convId" placeholder="Conversation ID (e.g. 1)" type="number" />
      <button onclick="joinRoom()">Join</button>
    </div>
  </div>

  <!-- Send message -->
  <div class="section">
    <h3>3 — Send Message</h3>
    <div class="row">
      <input id="msgConvId"  placeholder="Conversation ID" type="number" />
      <input id="msgContent" placeholder="Message text" />
      <button class="orange" onclick="sendMessage()">Send</button>
    </div>
  </div>

  <!-- Listen -->
  <div class="section">
    <h3>4 — Event Log <button style="float:right;padding:4px 10px;font-size:11px" onclick="clearLog()">Clear</button></h3>
    <div id="log"><span class="info">Waiting for events…</span></div>
  </div>

<script>
  let socket = null;

  function log(msg, cls = 'info') {
    const div = document.getElementById('log');
    const now = new Date().toLocaleTimeString();
    div.innerHTML += \`<div class="\${cls}">[<b>\${now}</b>] \${msg}</div>\`;
    div.scrollTop = div.scrollHeight;
  }

  function setStatus(on) {
    document.getElementById('status').className     = on ? 'on' : '';
    document.getElementById('statusText').innerText = on ? 'Connected ✅' : 'Disconnected ❌';
  }

  function clearLog() {
    document.getElementById('log').innerHTML = '';
  }

  function connectSocket() {
    const token = document.getElementById('token').value.trim();
    if (!token) { log('⚠️ Paste your token first', 'err'); return; }

    if (socket) { socket.disconnect(); }

    log('Connecting to server…', 'info');

    socket = io(window.location.origin, {
      transports: ['websocket'],
      auth: { token }
    });

    socket.on('connect', () => {
      log('✅ Connected! Socket ID: ' + socket.id, 'ok');
      setStatus(true);
    });

    socket.on('connect_error', (err) => {
      log('❌ Connection error: ' + err.message, 'err');
      setStatus(false);
    });

    socket.on('disconnect', (reason) => {
      log('❌ Disconnected: ' + reason, 'err');
      setStatus(false);
    });

    // ── Listen for all incoming events ──
    socket.on('new_message', (data) => {
      log('📨 new_message: ' + JSON.stringify(data), 'in');
    });

    socket.on('typing_start', (data) => {
      log('✍️ typing_start: ' + JSON.stringify(data), 'in');
    });

    socket.on('typing_stop', (data) => {
      log('🛑 typing_stop: ' + JSON.stringify(data), 'in');
    });

    socket.on('user_status', (data) => {
      log('👤 user_status: ' + JSON.stringify(data), 'in');
    });

    socket.on('messages_read', (data) => {
      log('👁 messages_read: ' + JSON.stringify(data), 'in');
    });
  }

  function disconnectSocket() {
    if (socket) { socket.disconnect(); socket = null; }
    log('Manually disconnected', 'info');
    setStatus(false);
  }

  function joinRoom() {
    if (!socket?.connected) { log('⚠️ Connect first!', 'err'); return; }
    const cid = document.getElementById('convId').value;
    if (!cid) { log('⚠️ Enter a conversation ID', 'err'); return; }
    socket.emit('join', parseInt(cid));
    log('📤 Emitted join → conv ' + cid, 'out');
  }

  function sendMessage() {
    if (!socket?.connected) { log('⚠️ Connect first!', 'err'); return; }
    const cid     = document.getElementById('msgConvId').value;
    const content = document.getElementById('msgContent').value.trim();
    if (!cid || !content) { log('⚠️ Fill in conversation ID and message', 'err'); return; }

    const payload = {
      conversationId: parseInt(cid),
      messageType:    'text',
      content:        content,
    };

    log('📤 Emitting send_message: ' + JSON.stringify(payload), 'out');

    socket.emitWithAck('send_message', payload).then(ack => {
      log('✅ ACK received: ' + JSON.stringify(ack), 'ok');
    }).catch(err => {
      log('❌ ACK error: ' + err, 'err');
    });
  }
</script>
</body>
</html>
`;

module.exports = SOCKET_TEST_HTML;