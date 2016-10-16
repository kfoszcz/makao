var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var striptags = require('striptags');
var Table = require('./Table.js');
var Card = require('./Card.js');
var Player = require('./Player.js');

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

		default:
			socket.emit('chatReceive', 'Unknown command');
	}
}

io.on('connection', function(socket){
	// emit table status to connecting client
	// console.log('User connected #' + socket.id + ' from ' + socket.request.connection.remoteAddress);
	socket.emit('tableStatus', table.getPlayerNames());

	socket.on('disconnect', function(){
		console.log('User ' + socket.name + ' disconnected');
		var player = table.findPlayerById(socket.id);
		if (player) {
			table.removePlayer(player.seat);
			socket.broadcast.emit('updateTable', player.seat, null);
			socket.broadcast.emit('chatReceive', 'Użytkownik <b>' + player.name + '</b> rozłączył się.');
		}
	});

	socket.on('seatRequest', function(seat, name){
		var result = table.addPlayer(seat, new Player(socket.id, name, seat, socket));
		socket.name = name;
		console.log('User #' + socket.id + ' changed name to ' + socket.name);
		socket.emit('seatResponse', result);
		if (result) {
			socket.broadcast.emit('updateTable', seat, name);
			socket.emit('chatReceive', 'Witaj <b>' + socket.name + '</b>!');
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

