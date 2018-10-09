var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var striptags = require('striptags');
var Table = require('./Table.js');
var Card = require('./Card.js');
var Player = require('./Player.js');
var Game = require('./Game.js');
var Room = require('./Room.js');
var cookieSession = require('cookie-session');
var bodyParser = require('body-parser');
var exphbs  = require('express-handlebars');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieSession({
  name: 'session',
  keys: ['jac098fawnpc49'],

  // Cookie Options
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

var locked = false;

app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

app.use(express.static(__dirname + '/public'));

app.get('/test/:id', function(req, res){
	if (isNaN(req.params.id))
		res.send('Error');
	else
		res.send('OK: ' + parseInt(req.params.id));
});

app.get('/', function(req, res){
	if (req.session.name)
		res.redirect('/tables');
	else
		res.redirect('/login');
});

app.get('/tables', function(req, res){
	if (!req.session.name)
		res.redirect('/login');
	else
		res.render('tables', { name: req.session.name });
});

app.get('/table/:id', function(req, res){
	if (!req.session.name)
		res.redirect('/login');
	else if (isNaN(req.params.id))
		res.send('Stół nie istnieje!');
	else
		res.render('table', { tableId: req.params.id, name: req.session.name });
});

app.get('/login', function(req, res){
	if (req.session.name)
		res.redirect('/tables');
	else
		res.sendFile(__dirname + '/public/login.html');
});

app.get('/logout', function(req, res){
	req.session = null;
	res.redirect('/login');
});

app.post('/login', function(req, res){
	if (req.body.login) {
		req.session.name = req.body.login;
		res.redirect('/tables');
	}
	else {
		res.sendFile(__dirname + '/public/login.html');
	}
});

http.listen(3000, function(){
	console.log('Listening on 3000');
});

var room = new Room(1, 10);
room.addTable();

function executeCmd(tableId, socket, cmd, arg) {
	var table = room.getTable(tableId);
	if (!table) {
		return;
	}
	var executor = table.findPlayerById(socket.id);
	if (!executor)
		return false;
	if (!executor.admin && cmd !== 'admin') {
		socket.emit('chatReceive', 'Odmowa dostępu!');
		return false;
	}

	switch (cmd) {
		case 'kick':
			console.log(arg);
			var player = table.findPlayerByName(arg);
			if (player) {
				table.removePlayer(player.seat);
				tbl.to(table.id).emit('chatReceive', 'Użytkownik <b>' + arg + '</b> został wyproszony.');
				tbl.to(table.id).emit('updateTable', player.seat, null);
			}
			else {
				socket.emit('chatReceive', 'No such user.');
			}
			break;

		// this should be done in db as user role
		case 'admin':
			var pass = '7012';
			if (pass === arg) {
				executor.admin = true;
				socket.emit('chatReceive', 'Admin privileges granted.');
			}
			else
				socket.emit('chatReceive', 'Incorrect password.');
			break;

		case 'move':
			requestMove(table.id);
			break;

		case 'redeal':
			table.game.phase = 0;
			table.game.current = table.game.nextPlayer(table.game.dealer);
			newDeal(table.id, true);
			requestMove(table.id);
			break;

		case 'start':
			var val = parseInt(arg);
			table.options.deal_start = val;
			socket.emit('chatReceive', 'deal_start changed to ' + val);
			break;

		case 'end':
			var val = parseInt(arg);
			table.options.deal_end = val;
			socket.emit('chatReceive', 'deal_end changed to ' + val);
			break;

		case 'show':
			var player = table.findPlayerByName(arg);
			if (player) {
				var result = '<span class="chat-hand">';
				var suits = [
					'<span class="black">&clubs;</span>',
					'<span class="red">&diams;</span>',
					'<span class="red">&hearts;</span>',
					'<span class="black">&spades;</span>'
				];
				var order = [2, 3, 1, 0];
				var exists = false;
				for (var suit = 0; suit < 4; suit++) {
					result += suits[order[suit]];
					for (var j = 0; j < player.hand.length; j++)
						if (player.hand[j].suit === order[suit]) {
							result += Card.ranks[player.hand[j].rank];
							exists = true;
						}
					if (!exists)
						result += '-';
					result += ' ';
					exists = false;
				}
				result += '</span>';
				socket.emit('chatReceive', result);
			}
			break;

		case 'end-game':
			// todo
			table.game.running = false;
			table.game.paused = true;
			table.kickDisconnected();
			table.resetReady();
			tbl.to(table.id).emit('clearBoard');
			tbl.to(table.id).emit('endGame');
			tbl.to(table.id).emit('tableStatus', table.getPlayerNames());
			break;

		default:
			socket.emit('chatReceive', 'Unknown command');
	}
}

function newDeal(tableId, redeal) {
	var table = room.getTable(tableId);
	table.game.dealCards();
	var player = null;
	while (player = table.game.playerIter())
		player.socket.emit('handReceive', player.hand, player.maxBid, redeal);
	tbl.to(table.id).emit('trumpReceive', table.game.topCard);
}

function requestMove(tableId) {
	var table = room.getTable(tableId);
	if (table.game.request & Game.CHOOSE_MARRIAGE) {
		table.game.getExtraPlayer().socket.emit('moveRequest', 2, table.game.marriageOptions);
	}
	else {
		table.game.getCurrentPlayer().socket.emit('moveRequest', table.game.phase, table.game.current === table.game.leader);
	}
	table.game.getCurrentPlayer().socket.broadcast.to(table.id).emit('updateCurrentPlayer', table.game.current);
}

function sendFinalResults(tableId) {
	var table = room.getTable(tableId);
	var msgs = [
		'Gratulacje, jesteś zwycięzcą! :)',
		'Zająłeś drugie miejsce.',
		'Zająłeś trzecie miejsce.',
		'Zająłeś czwarte miejsce.'
	];

	var player = null;
	while (player = table.game.playerIter())
		player.socket.emit('chatReceive', msgs[table.game.getPlayerPlace(player.seat) - 1]);
}

var tbl = io.of('/table');
var lobby = io.of('/lobby');

lobby.on('connection', function(socket){
	socket.on('reconnect', function(){
		socket.emit('tablesStatus', room.getTablesStatus());
	});

	socket.on('hello', function(){
		socket.emit('tablesStatus', room.getTablesStatus());
	});

	socket.on('newTable', function(){
		room.addTable();
		lobby.emit('tablesStatus', room.getTablesStatus());
	});
});

tbl.on('connection', function(socket){
	// emit table status to connecting client
	// console.log(socket);

	socket.on('hello', function(tableId, name){
		tableId = parseInt(tableId);
		var table = room.getTable(tableId);
		if (!table) {
			return;
		}

		var ipAddr = socket.request.connection.remoteAddress;
		ipAddr = ipAddr.slice(ipAddr.lastIndexOf(':') + 1);
		if (ipAddr == '1')
			ipAddr = 'localhost';
		console.log(ipAddr);
		// socket.broadcast.to(table.id).emit('chatReceive', 'Połączenie z ' + ipAddr);
		table.users++;
		socket.join(table.id);
		socket.table = table.id;
		socket.name = name;
		socket.broadcast.to(table.id).emit('chatReceive', 'Przychodzi <b>' + name + '</b>.');
		socket.emit('chatReceive', 'Witaj <b>' + name + '</b>!');
		socket.emit('tableStatus', table.getPlayerNames());
		socket.emit('optionsUpdate', table.options);

		if (table.game && table.game.paused) {
			var player = table.findPlayerByName(name);

			// you can't change seat after reconnecting
			if (!player) {
				return false;
			}

			player.connected = true;
			player.id = socket.id;
			player.socket = socket;
			socket.name = name;
			player.status = 'connected';

			socket.emit('seatResponse', true, player.seat, player.name);
			socket.broadcast.to(table.id).emit('updatePlayerStatus', player.seat, player.status);
			socket.emit('tableStatus', table.getPlayerNames(true));
		
			for (var i = 0; i < 4; i++)
				if (table.players[i])
					socket.emit('updatePlayerStatus', i, table.players[i].status);

			socket.emit('reconnectState', table.game.getReconnectState(player.seat));

			// when all players are connected, resume game
			if (table.playersConnected()) {
				table.game.paused = false;
				requestMove(tableId);
			}
		}
	});

	socket.on('disconnect', function(){
		console.log('User ' + socket.name + ' disconnected');
		var table = room.getTable(socket.table);
		if (!table) {
			return;
		}
		var player = table.findPlayerById(socket.id);
		socket.broadcast.to(table.id).emit('chatReceive', 'Odchodzi <b>' + socket.name + '</b>.');
		if (player) {
			if (!table.game || !table.game.running) {
				table.removePlayer(player.seat);
				socket.broadcast.to(table.id).emit('updateTable', player.seat, null);
				lobby.emit('updateTable', table.id, player.seat, null);
			}
			else {
				table.game.paused = true;
				player.connected = false;
				player.status = 'disconnected';
				socket.broadcast.to(table.id).emit('updatePlayerStatus', player.seat, player.status);
			}
		}
		socket.leave(table.id);
		table.users--;
	});

	socket.on('optionsChange', function(options){
		var tableId = socket.table;
		var table = room.getTable(tableId);
		if (!table) {
			return;
		}

		if (table.game && table.game.running)
			return;

		if (isBetween(options.deal_start, 1, 103))
			table.options.deal_start = options.deal_start;

		if (isBetween(options.deal_end, 1, 103))
			table.options.deal_end = ((options.deal_end) >= table.options.deal_start) ? options.deal_end : table.options.deal_start;

		if (isBetween(options.decks, 1, 12))
			table.options.decks = options.decks;

		if (isBetween(options.quads_value, 0, 100))
			table.options.quads_value = options.quads_value;

		if (isBetween(options.win_value, 0, 100))
			table.options.win_value = options.win_value;

		if (options.marriages != null && typeof(options.marriages) === "boolean")
			table.options.marriages = options.marriages;

		if (options.half_marriages != null && typeof(options.half_marriages) == 'boolean')
			table.options.half_marriages = options.half_marriages;

		if (options.always_shuffle != null && typeof(options.always_shuffle) == 'boolean')
			table.options.always_shuffle = options.always_shuffle;

		if (options.handicap != null && typeof(options.handicap) == 'boolean')
			table.options.handicap = options.handicap;

		table.resetReady();

		tbl.to(table.id).emit('optionsUpdate', table.options);
		tbl.to(table.id).emit('chatReceive', 'Zmieniono ustawienia stołu.');
	});

	socket.on('stand', function(){
		var tableId = socket.table;
		var table = room.getTable(tableId);
		if (!table) {
			return;
		}
		var player = table.findPlayerById(socket.id);
		if (player) {
			if (!table.game || !table.game.running) {
				table.removePlayer(player.seat);
				socket.broadcast.to(table.id).emit('updateTable', player.seat, null);
				lobby.emit('updateTable', table.id, player.seat, null);
			}
		}
	});

	socket.on('blur', function(){
		var tableId = socket.table;
		var table = room.getTable(tableId);
		if (!table) {
			return;
		}
		var player = table.findPlayerById(socket.id);
		if (player) {
			player.status = 'inactive';
			socket.broadcast.to(table.id).emit('updatePlayerStatus', player.seat, player.status);
		}
	});

	socket.on('focus', function(){
		var tableId = socket.table;
		var table = room.getTable(tableId);
		if (!table) {
			return;
		}
		var player = table.findPlayerById(socket.id);
		if (player) {
			player.status = 'connected';
			socket.broadcast.to(table.id).emit('updatePlayerStatus', player.seat, player.status);
		}
	});

	socket.on('seatRequest', function(seat, name){
		var tableId = socket.table;
		var table = room.getTable(tableId);
		if (!table) {
			return;
		}
		if (!table.game || !table.game.running) {
			var result = table.addPlayer(seat, new Player(socket.id, name, seat, socket, table.id));
			socket.name = name;
			socket.emit('seatResponse', result, seat, name);
			if (result) {
				socket.broadcast.to(table.id).emit('updateTable', seat, name);
				lobby.emit('updateTable', table.id, seat, name);
			}
			for (var i = 0; i < 4; i++)
				if (table.players[i])
					socket.emit('updatePlayerStatus', i, table.players[i].status);
		}
		else {
			socket.emit('seatResponse', false);
		}
		// console.log(table.players);
	});

	socket.on('playerReady', function(){
		var tableId = socket.table;
		var table = room.getTable(tableId);
		if (!table) {
			return;
		}
		var player = table.findPlayerById(socket.id);
		if (!player)
			return false;
		player.ready = true;

		if (table.playersReady()) {
			// start game
			tbl.to(table.id).emit('chatReceive', 'Zaczynamy grę. Powodzenia!');
			table.game = new Game(table.players, table.options);
			// console.log(table.game);
			table.game.init();
			tbl.to(table.id).emit('startGame', table.game.options);
			newDeal(table.id);
			requestMove(table.id);
		}
		else {
			for (var i = 0; i < 4; i++)
				if (table.players[i] && !table.players[i].ready)
					table.players[i].socket.emit('ding');
		}
	});

	socket.on('moveSend', function(type, value, marriage){
		var tableId = socket.table;
		var table = room.getTable(tableId);
		if (!table) {
			return;
		}
		if (marriage && marriage.length == 0)
			marriage = null;
		if (type == 1) {
			// cast type to Card
			var logMsg = 'Received move: [ ';
			for (var i = 0 ; i < value.length; i++) {
				value[i] = Object.assign(new Card(), value[i]);
				// var card = new Card(value[i].suit, value[i].rank);
				logMsg += (value[i].print() + ' ');
			}
			logMsg += ']';
			if (marriage) {
				logMsg += ' + [ ';
				for (var i = 0 ; i < marriage.length; i++) {
					marriage[i] = Object.assign(new Card(), marriage[i]);
					// var card = new Card(marriage[i].suit, marriage[i].rank);
					logMsg += (marriage[i].print() + ' ');
				}
				logMsg += ']';
			}
			console.log(logMsg);
		}
		var invalid = false;
		if (!table.game.running || table.game.paused || locked)
			invalid = true;

		if (type == 2) {
			if (socket.id != table.game.getExtraPlayer().id)
				invalid = true;
			if (table.game.marriageOptions.length == 0)
				invalid = true;
		}
		else {
			if (type != table.game.phase)
				invalid = true;
			else if (socket.id != table.game.getCurrentPlayer().id)
				invalid = true;
		}
		
		if (invalid) {
			socket.emit('moveOK', false);
			return false;
		}

		var current = table.game.current;
		var result = table.game.move(type, value, marriage);
		socket.emit('moveOK', result);
		if (result) {
			var moveTimeout = 0;
			if (type != 2)
				socket.broadcast.to(table.id).emit('moveReceive', current, type, value, marriage);
			if (table.game.request & Game.CHOOSE_MARRIAGE) {
				requestMove(table.id);
				return true;
			}
			if (table.game.request & Game.FIRST_ORBIT) {
				tbl.to(table.id).emit('tricksInit');
			}
			if (table.game.request & Game.PHASE_CHANGE) {
				tbl.to(table.id).emit('updatePhase', table.game.phase);
			}
			if (table.game.request & Game.ADD_EXTRA) {
				tbl.to(table.id).emit('tricksUpdate', table.game.extra, table.game.getExtraPlayer().tricks);
				tbl.to(table.id).emit('extraUpdate', table.game.totalExtra);
				/*if (table.game.showCards.length) {
					socket.broadcast.to(table.id).emit('trumpUpdate', table.game.showCards[0].suit);
					socket.broadcast.to(table.id).emit('showCards', table.game.extra, table.game.showCards);
				}*/
			}
			if (table.game.request & Game.NEW_ORBIT) {
				locked = true;
				moveTimeout = 1000;
				tbl.to(table.id).emit('tricksUpdate', table.game.best, table.game.getTrickWinner().tricks);
				setTimeout(function(){
					table.game.clearBoard();
					tbl.to(table.id).emit('clearBoard');
					locked = false;
				}, 1000);
			}
			if (table.game.request & Game.END_GAME) {
				tbl.to(table.id).emit('scoresUpdate', table.game.getScores());
				locked = true;
				table.resetReady();
				setTimeout(function(){
					tbl.to(table.id).emit('endGame');
					sendFinalResults(table.id);
					table.game.running = false;
					locked = false;
				}, 2000);
				table.game.request = 0;
				return;
			}
			if (table.game.request & Game.NEW_DEAL) {
				tbl.to(table.id).emit('scoresUpdate', table.game.getScores());
				locked = true;
				moveTimeout = 2000;
				setTimeout(function(){
					newDeal(table.id);
					locked = false;
				}, 2000);
			}
			setTimeout(function(){
				requestMove(table.id);
			}, moveTimeout);
			table.game.request = 0;
		}
	});

	socket.on('chatMsg', function(msg){
		var tableId = socket.table;
		var table = room.getTable(tableId);
		if (!table) {
			return;
		}
		if (msg[0] === '\\') {
			var args = msg.slice(1).split(' ', 2);
			executeCmd(table.id, socket, args[0], args[1]);
			return;
		}
		var sender = (socket.name != null) ? socket.name : 'Guest';
		// if message is not from server, strip html tags
		if (sender)
			striptags(msg);
		// console.log('Message from ' + sender + ': ' + msg);
		tbl.to(table.id).emit('chatReceive', msg, sender);
	});

});

function isBetween(value, min, max) {
	return (value && Number.isInteger(value) && value >= min && value <= max);
}

/* remove empty tables every 1 minute */
setInterval(function(){
	room.removeEmptyTables();
	lobby.emit('tablesStatus', room.getTablesStatus());
}, 60000);
