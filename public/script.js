const socket = io(window.location.origin);
let myName = '';

function joinGame() {
  myName = document.getElementById('name').value.trim();
  if (!myName) return;
  socket.emit('join', myName);
  document.getElementById('login').style.display = 'none';
  document.getElementById('game').style.display = 'block';
}

socket.on('players', (players) => {
  const container = document.getElementById('players');
  const all = Object.values(players);
  container.innerHTML = '<h3>Players</h3>' + all.map(p => 
    `${p.name}: $${p.money}`
  ).join('<br>');

  // Show "Start Game" button only if I'm the first player
  if (all[0].name === myName && all.length > 1) {
    document.getElementById('start-btn').style.display = 'inline-block';
  } else {
    document.getElementById('start-btn').style.display = 'none';
  }
});

socket.on('roundNumber', ({ round, total }) => {
  document.getElementById('round-info').textContent = `Round ${round} of ${total}`;
});

socket.on('newItem', (item) => {
  document.getElementById('item-name').textContent = item.name;
  document.getElementById('item-desc').textContent = item.description;
  document.getElementById('item-image').src = item.image;
  document.getElementById('current-bid').textContent = 'Current Bid: $0';
  document.getElementById('result').textContent = '';
});

socket.on('newBid', ({ bidder, bid }) => {
  document.getElementById('current-bid').textContent = `Current Bid: $${bid} by ${bidder}`;
});

socket.on('roundResult', ({ winner, bid, item }) => {
  document.getElementById('result').textContent = winner 
    ? `${winner} won the ${item.name} for $${bid}!` 
    : 'No one bid on the item.';
});

socket.on('gameOver', (results) => {
  let output = '<h2>Game Over</h2>';
  for (const [name, data] of Object.entries(results)) {
    output += `<h3>${name}</h3><ul>` + 
              data.items.map(i => `<li>${i.name} (Paid: $${i.paid}, Value: $${i.value}, Profit: $${i.profit})</li>`).join('') + 
              `</ul><strong>Total Profit: $${data.profit}</strong><br>`;
  }
  document.getElementById('game').innerHTML = output;
});

function startGame() {
  socket.emit('startGame');
  document.getElementById('start-btn').style.display = 'none';
}

function bid() {
  socket.emit('bid');
}

function walk() {
  socket.emit('walk');
}
