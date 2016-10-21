var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var striptags = require('striptags');
var Table = require('./Table.js');
var Card = require('./Card.js');
var Player = require('./Player.js');
var Game = require('./Game.js')

var locked = false;

app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

http.listen(3000, function(){
	console.log('Listening on 3000');
});

var table = new Table(1);

function executeCmd(socket, cmd, arg) {
	switch (cmd) {
		case 'kick':
			console.log(arg);
			var player = table.findPlayerByName(arg);
			if (player) {
				table.removePlayer(player.seat);
				io.emit('chatReceive', 'Użytkownik <b>' + arg + '</b> został wyproszony.');
				io.emit('updateTable', player.seat, null);
			}
			else {
				socket.emit('chatReceive', 'No such user.');
			}
			break;

		case 'end':
			// todo
			table.game.running = false;
			break;

		default:
			socket.emit('chatReceive', 'Unknown command');
	}
}

function newDeal() {
	table.game.dealCards();
	var player = null;
	while (player = table.game.playerIter())
		player.socket.emit('handReceive', player.hand);
	io.emit('trumpReceive', table.game.topCard);
}

function requestMove() {
	table.game.getCurrentPlayer().socket.emit('moveRequest', table.game.phase, table.game.current === table.game.leader);
	table.game.getCurrentPlayer().socket.broadcast.emit('updateCurrentPlayer', table.game.current);
}

io.on('connection', function(socket){
	// emit table status to connecting client
	// console.log('User connected #' + socket.id + ' from ' + socket.request.connection.remoteAddress);
	socket.emit('tableStatus', table.getPlayerNames());

	socket.on('disconnect', function(){
		console.log('User ' + socket.name + ' disconnected');
		var player = table.findPlayerById(socket.id);
		if (player) {
			if (!table.game || !table.game.running) {
				table.removePlayer(player.seat);
			}
			else {
				table.game.paused = true;
				player.connected = false;
			}
			socket.broadcast.emit('updateTable', player.seat, null);
			socket.broadcast.emit('chatReceive', 'Użytkownik <b>' + player.name + '</b> rozłączył się.');
		}
	});

	socket.on('seatRequest', function(seat, name){
		if (!table.game || !table.game.running) {
			var result = table.addPlayer(seat, new Player(socket.id, name, seat, socket));
			socket.name = name;
			console.log('User #' + socket.id + ' changed name to ' + socket.name);
			socket.emit('seatResponse', result);
			if (result) {
				socket.broadcast.emit('updateTable', seat, name);
				socket.emit('chatReceive', 'Witaj <b>' + socket.name + '</b>!');
			}
		}
		else if (table.game.paused) {
			var player = table.findPlayerByName(name);
		}
		// console.log(table.players);
	});

	socket.on('playerReady', function(){
		var player = table.findPlayerById(socket.id);
		if (!player)
			return false;
		player.ready = true;
		
		if (table.playersReady()) {
			// start game
			io.emit('chatReceive', 'Zaczynamy grę. Powodzenia!');
			io.emit('startGame');
			table.game = new Game(table.players);
			// console.log(table.game);
			table.game.init();
			newDeal();
			requestMove();
		}
	});

	socket.on('moveSend', function(type, value){
		if (!table.game.running || table.game.paused)
			return false;
		if (type == 1) {
			// cast type to Card
			var logMsg = 'Received move: [ ';
			for (var i = 0 ; i < value.length; i++) {
				value[i] = Object.assign(new Card(), value[i]);
				// var card = new Card(value[i].suit, value[i].rank);
				logMsg += (value[i].print() + ' ');
			}
			logMsg += ']';
			console.log(logMsg);
		}
		if (socket.id != table.game.getCurrentPlayer().id || locked)
			return false;
		if (type != table.game.phase)
			return false;
		var current = table.game.current;
		var result = table.game.move(type, value);
		socket.emit('moveOK', result);
		if (result) {
			var moveTimeout = 0;
			socket.broadcast.emit('moveReceive', current, type, value);
			if (table.game.request & Game.FIRST_ORBIT) {
				io.emit('tricksInit');
			}
			if (table.game.request & Game.NEW_ORBIT) {
				locked = true;
				moveTimeout = 1000;
				io.emit('tricksUpdate', table.game.best, table.game.getTrickWinner().tricks);
				setTimeout(function(){
					io.emit('clearBoard');
					locked = false;
				}, 1000);
			}
			if (table.game.request & Game.END_GAME) {
				io.emit('scoresUpdate', table.game.getScores());
				locked = true;
				for (var i = 0; i < 4; i++)
					if (table.players[i])
						table.players[i].ready = false;
				setTimeout(function(){
					io.emit('endGame');
					io.emit('chatReceive', 'Koniec gry :)');
					table.game.running = false;
					locked = false;
				}, 2000);
				table.game.request = 0;
				return;
			}
			if (table.game.request & Game.NEW_DEAL) {
				io.emit('scoresUpdate', table.game.getScores());
				locked = true;
				moveTimeout = 2000;
				setTimeout(function(){
					newDeal();
					locked = false;
				}, 2000);
			}
			setTimeout(requestMove, moveTimeout);
			table.game.request = 0;
		}
	});

	socket.on('chatMsg', function(msg){
		if (msg[0] === ':') {
			var args = msg.slice(1).split(' ', 2);
			executeCmd(socket, args[0], args[1]);
			return;
		}
		var sender = (socket.name != null) ? socket.name : 'Guest';
		// if message is not from server, strip html tags
		if (sender)
			striptags(msg);
		console.log('Message from ' + sender + ': ' + msg);
		io.emit('chatReceive', msg, sender);
	});

});

