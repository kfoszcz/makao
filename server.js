var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var striptags = require('striptags');
var Table = require('./Table.js');
var Card = require('./Card.js');
var Player = require('./Player.js');
var Game = require('./Game.js')
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
app.use(express.static(__dirname + '/public/img'));

app.get('/', function(req, res){
	if (req.session.name)
		res.redirect('/table');
	else
		res.redirect('/login');
});

app.get('/table', function(req, res){
	if (!req.session.name)
		res.redirect('/login');
	else
		res.render('table', { name: req.session.name });
});

app.get('/login', function(req, res){
	if (req.session.name)
		res.redirect('/table');
	else
		res.sendFile(__dirname + '/public/login.html');
});

app.get('/logout', function(req, res){
	req.session = null;
	res.redirect('/login');
});

app.post('/login', function(req, res){
	console.log('login post');
	if (req.body.login) {
		req.session.name = req.body.login;
		res.redirect('/table');
	}
	else {
		res.sendFile(__dirname + '/public/login.html');
	}
});

http.listen(3000, function(){
	console.log('Listening on 3000');
});

var table = new Table(1);
var gameOptions = {
	'deal_start': 1,
	'deal_end': 24,
	'marriages': true,
	'half_marriages': true,
	'always_shuffle': false,
	'pairs': true,
	'quads_value': 20,
	'players_min': 2,
	'players_max': 4,
	'decks': 4,
	'handicap': true,
	'suit_values': [4, 8, 10, 6],
	'win_value': 10
};

function executeCmd(socket, cmd, arg) {
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
				io.emit('chatReceive', 'Użytkownik <b>' + arg + '</b> został wyproszony.');
				io.emit('updateTable', player.seat, null);
			}
			else {
				socket.emit('chatReceive', 'No such user.');
			}
			break;

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
			requestMove();
			break;

		case 'redeal':
			table.game.phase = 0;
			table.game.current = table.game.nextPlayer(table.game.dealer);
			newDeal(true);
			requestMove();
			break;

		case 'start':
			var val = parseInt(arg);
			gameOptions.deal_start = val;
			socket.emit('chatReceive', 'deal_start changed to ' + val);
			break;

		case 'end':
			var val = parseInt(arg);
			gameOptions.deal_end = val;
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
			io.emit('clearBoard');
			io.emit('endGame');
			io.emit('tableStatus', table.getPlayerNames());
			break;

		default:
			socket.emit('chatReceive', 'Unknown command');
	}
}

function newDeal(redeal) {
	table.game.dealCards();
	var player = null;
	while (player = table.game.playerIter())
		player.socket.emit('handReceive', player.hand, player.maxBid, redeal);
	io.emit('trumpReceive', table.game.topCard);
}

function requestMove() {
	if (table.game.request & Game.CHOOSE_MARRIAGE) {
		table.game.getExtraPlayer().socket.emit('moveRequest', 2, table.game.marriageOptions);
	}
	else {
		table.game.getCurrentPlayer().socket.emit('moveRequest', table.game.phase, table.game.current === table.game.leader);
	}
	table.game.getCurrentPlayer().socket.broadcast.emit('updateCurrentPlayer', table.game.current);
}

function sendFinalResults() {
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

io.on('connection', function(socket){
	// emit table status to connecting client
	// console.log(socket);

	socket.on('hello', function(name){
		var ipAddr = socket.request.connection.remoteAddress;
		ipAddr = ipAddr.slice(ipAddr.lastIndexOf(':') + 1);
		if (ipAddr == '1')
			ipAddr = 'localhost';
		console.log(ipAddr);
		// socket.broadcast.emit('chatReceive', 'Połączenie z ' + ipAddr);
		socket.name = name;
		socket.broadcast.emit('chatReceive', 'Przychodzi <b>' + name + '</b>.');
		socket.emit('chatReceive', 'Witaj <b>' + name + '</b>!');
		socket.emit('tableStatus', table.getPlayerNames());

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
			socket.broadcast.emit('updatePlayerStatus', player.seat, player.status);
			socket.emit('tableStatus', table.getPlayerNames(true));
		
			for (var i = 0; i < 4; i++)
				if (table.players[i])
					socket.emit('updatePlayerStatus', i, table.players[i].status);

			socket.emit('reconnectState', table.game.getReconnectState(player.seat));

			// when all players are connected, resume game
			if (table.playersConnected()) {
				table.game.paused = false;
				requestMove();
			}
		}
	});

	socket.on('disconnect', function(){
		console.log('User ' + socket.name + ' disconnected');
		var player = table.findPlayerById(socket.id);
		socket.broadcast.emit('chatReceive', 'Odchodzi <b>' + socket.name + '</b>.');
		if (player) {
			if (!table.game || !table.game.running) {
				table.removePlayer(player.seat);
				socket.broadcast.emit('updateTable', player.seat, null);
			}
			else {
				table.game.paused = true;
				player.connected = false;
				player.status = 'disconnected';
				socket.broadcast.emit('updatePlayerStatus', player.seat, player.status);
			}
		}
	});

	socket.on('stand', function(){
		var player = table.findPlayerById(socket.id);
		if (player) {
			if (!table.game || !table.game.running) {
				table.removePlayer(player.seat);
				socket.broadcast.emit('updateTable', player.seat, null);
			}
		}
	});

	socket.on('blur', function(){
		var player = table.findPlayerById(socket.id);
		if (player) {
			player.status = 'inactive';
			socket.broadcast.emit('updatePlayerStatus', player.seat, player.status);
		}
	});

	socket.on('focus', function(){
		var player = table.findPlayerById(socket.id);
		if (player) {
			player.status = 'connected';
			socket.broadcast.emit('updatePlayerStatus', player.seat, player.status);
		}
	});

	socket.on('seatRequest', function(seat, name){
		if (!table.game || !table.game.running) {
			var result = table.addPlayer(seat, new Player(socket.id, name, seat, socket));
			socket.name = name;
			console.log('User #' + socket.id + ' changed name to ' + socket.name);
			socket.emit('seatResponse', result, seat, name);
			if (result) {
				socket.broadcast.emit('updateTable', seat, name);
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
		var player = table.findPlayerById(socket.id);
		if (!player)
			return false;
		player.ready = true;

		if (table.playersReady()) {
			// start game
			io.emit('chatReceive', 'Zaczynamy grę. Powodzenia!');
			table.game = new Game(table.players, gameOptions);
			// console.log(table.game);
			table.game.init();
			io.emit('startGame', table.game.options);
			newDeal();
			requestMove();
		}
		else {
			for (var i = 0; i < 4; i++)
				if (table.players[i] && !table.players[i].ready)
					table.players[i].socket.emit('ding');
		}
	});

	socket.on('moveSend', function(type, value, marriage){
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
				socket.broadcast.emit('moveReceive', current, type, value, marriage);
			if (table.game.request & Game.CHOOSE_MARRIAGE) {
				console.log(table.game.marriageOptions);
				requestMove();
				return true;
			}
			if (table.game.request & Game.FIRST_ORBIT) {
				io.emit('tricksInit');
			}
			if (table.game.request & Game.PHASE_CHANGE) {
				io.emit('updatePhase', table.game.phase);
			}
			if (table.game.request & Game.ADD_EXTRA) {
				io.emit('tricksUpdate', table.game.extra, table.game.getExtraPlayer().tricks);
				io.emit('extraUpdate', table.game.totalExtra);
				/*if (table.game.showCards.length) {
					socket.broadcast.emit('trumpUpdate', table.game.showCards[0].suit);
					socket.broadcast.emit('showCards', table.game.extra, table.game.showCards);
				}*/
			}
			if (table.game.request & Game.NEW_ORBIT) {
				locked = true;
				moveTimeout = 1000;
				io.emit('tricksUpdate', table.game.best, table.game.getTrickWinner().tricks);
				setTimeout(function(){
					table.game.clearBoard();
					io.emit('clearBoard');
					locked = false;
				}, 1000);
			}
			if (table.game.request & Game.END_GAME) {
				io.emit('scoresUpdate', table.game.getScores());
				locked = true;
				table.resetReady();
				setTimeout(function(){
					io.emit('endGame');
					sendFinalResults();
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
		if (msg[0] === '\\') {
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

