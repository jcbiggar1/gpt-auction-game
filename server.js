const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { OpenAI } = require('openai');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(cors());
app.use(express.static('public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let players = {};
let currentItem = null;
let currentBid = 0;
let currentWinner = null;
let bidTimeout;
let round = 0;
let auctionHistory = [];

const MAX_ROUNDS = 10;
const STARTING_MONEY = 10000;
const BID_INCREMENT = 200;
const INACTIVITY_LIMIT = 5000; // 5 seconds

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('join', (name) => {
    if (Object.keys(players).length >= 8) {
      socket.emit('gameFull');
      return;
    }
    players[socket.id] = { name, money: STARTING_MONEY, items: [] };
    io.emit('players', players);
    if (Object.keys(players).length === 2) startNextRound(); // Change to 8 to auto-start
  });

  socket.on('bid', () => {
    if (!currentItem || !players[socket.id]) return;
    const newBid = currentBid + BID_INCREMENT;
    if (players[socket.id].money < newBid) return;
    currentBid = newBid;
    currentWinner = socket.id;
    io.emit('newBid', { bidder: players[socket.id].name, bid: currentBid });
    resetBidTimer();
  });

  socket.on('walk', () => {
    players[socket.id].walked = true;
    checkAuctionEnd();
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('players', players);
  });
});

function resetBidTimer() {
  clearTimeout(bidTimeout);
  bidTimeout = setTimeout(() => {
    if (currentWinner) {
      const winner = players[currentWinner];
      winner.money -= currentBid;
      winner.items.push({ ...currentItem, paid: currentBid });
      auctionHistory.push({ ...currentItem, paid: currentBid, winner: winner.name });
    }
    io.emit('roundResult', {
      winner: currentWinner ? players[currentWinner].name : null,
      bid: currentBid,
      item: currentItem
    });
    Object.values(players).forEach(p => p.walked = false);
    currentItem = null;
    currentBid = 0;
    currentWinner = null;
    round++;
    if (round < MAX_ROUNDS) {
      setTimeout(startNextRound, 3000);
    } else {
      io.emit('gameOver', calculateResults());
    }
  }, INACTIVITY_LIMIT);
}

function checkAuctionEnd() {
  const active = Object.values(players).filter(p => !p.walked);
  if (active.length <= 1) resetBidTimer();
}

async function startNextRound() {
  const item = await generateItem();
  currentItem = item;
  currentBid = 0;
  currentWinner = null;
  io.emit('newItem', item);
}

async function generateItem() {
  const chat = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{
      role: "user",
      content: `Create a mysterious auction item. Respond in JSON like this:
{
  "name": "The Whispering Box",
  "description": "Said to echo with secrets of ancient kings.",
  "value": 4200
}`
    }]
  });
  const item = JSON.parse(chat.choices[0].message.content);

  const img = await openai.images.generate({
    prompt: `${item.name} - ${item.description}`,
    n: 1,
    size: "512x512"
  });

  item.image = img.data[0].url;
  return item;
}

function calculateResults() {
  const results = {};
  Object.entries(players).forEach(([id, p]) => {
    let profit = 0;
    const items = p.items.map(i => {
      const gain = i.value - i.paid;
      profit += gain;
      return { ...i, profit: gain };
    });
    results[p.name] = { profit, items };
  });
  return results;
}

server.listen(3000, () => console.log('Server running on http://localhost:3000'));
