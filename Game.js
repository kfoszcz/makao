var Player = require('./Player.js');
var Deck = require('./Deck.js');
var Card = require('./Card.js');
var Score = require('./Score.js');

function Game(players, options) {
	this.options = options;
	this.playersCount = 0;
	this.seats = [];
	this.phase = Game.PHASE_BIDDING;
	this.deal = this.options.deal_start;
	this.dealer = null;
	this.leader = null;
	this.current = null;
	this.topCard = null;
	this.extra = null; // player with extra points to add (marriage or quads)
	this.paused = true;
	this.deck = new Deck(this.options.decks);
	this.trump = null;
	this.trumpChanged = false;
	this.board = [[], [], [], []];
	this.lastBoard = [[], [], [], []];
	this.best = null;
	this.bestValue = 0;
	this.players = players;
	this.iter = 0;
	this.request = 0;
	this.running = false;
	this.maxValueSuit = null;
	this.showCards = [];
	this.totalExtra = 0;
	this.marriageOptions = [];
}

Game.PHASE_BIDDING = 0;
Game.PHASE_PLAY = 1;

Game.KING = 1;
Game.QUEEN = 2;
Game.JACK = 4;

Game.NEW_ORBIT = 1;
Game.NEW_DEAL = 2;
Game.FIRST_ORBIT = 4;
Game.END_GAME = 8;
Game.ADD_EXTRA = 16;
Game.CHOOSE_MARRIAGE = 32;
Game.PHASE_CHANGE = 64;

Game.prototype.playerIter = function() {
	var result = this.players[this.seats[this.iter]];
	if (++this.iter > this.playersCount) {
		this.iter = 0;
		return null;
	}
	return result;
}

Game.prototype.getCurrentPlayer = function() {
	return this.players[this.current];
}

Game.prototype.leadingSuit = function() {
	return this.board[this.leader][0].suit;
}

Game.prototype.nextPlayer = function(index) {
	do {
		index = (index + 1) % 4;
	} while (!this.players[index]);
	return index;
}

Game.prototype.init = function() {
	var bestVal = 0;
	for (var i = 0; i < 4; i++)
		if (this.options.suit_values[i] > bestVal) {
			this.maxValueSuit = i;
			bestVal = this.options.suit_values[i];
		}

	for (var i = 0; i < 4; i++)
		if (this.players[i]) {
			this.players[i].sequence = this.playersCount++;
			this.seats.push(i);
		}

	var rnd = Math.floor(Math.random() * this.playersCount);
	this.dealer = this.seats[rnd];
	this.leader = this.nextPlayer(this.dealer);
	this.current = this.leader;
	this.best = this.leader;
	this.deck.shuffle();
	this.running = true;
	this.paused = false;
	for (var i = 0; i < 4; i++)
		if (this.players[i]) {
			this.players[i].resetScores();
			this.players[i].declared = null;
			this.players[i].tricks = 0;
		}
}

Game.prototype.dealCards = function() {
	this.initDeal();
	var cardsNeeded = this.playersCount * this.deal + 1;
	if (this.options.always_shuffle || cardsNeeded > this.deck.size())
		this.deck.shuffle();

	for (var i = 0; i < this.playersCount; i++)
		this.players[this.seats[i]].hand = Card.sortCards(this.deck.draw(this.deal));

	this.topCard = this.deck.draw(1)[0];
	this.trump = this.topCard.suit;

	// calculate marriage info
	var player = null;
	while (player = this.playerIter()) {
		player.updateMarriages();
		player.maxBid = this.maxDeclaration(player.seat);
	}
}

Game.prototype.boardValue = function(cards) {
	var shift = 0;
	var result = 0;
	for (var i = cards.length - 1; i >= 0; i--) {
		result |= cards[i].rank << shift;
		shift += 4;
	}
	result |= this.sameCards(cards) << shift++;
	if (this.current != this.leader)
		result |= this.onlySuit(cards, this.leadingSuit()) << shift++;
	else
		result |= 1 << shift++;
	result |= this.onlySuit(cards, this.trump) << shift++;
	return result;
}

Game.prototype.initDeal = function() {
	this.trumpChanged = false;
	this.totalExtra = 0;
	this.marriageOptions = [];
	var player = null;
	while (player = this.playerIter()) {
		player.tricks = 0;
		player.declared = null;
		player.resetMarriages();
	}
}

Game.prototype.move = function(type, value, marriage) {
	if (type == 2) {
		if (this.marriageOptions.indexOf(value) === -1)
			return false;
		this.request -= Game.CHOOSE_MARRIAGE;
		this.request |= Game.ADD_EXTRA;
		this.totalExtra += value;
		this.players[this.extra].tricks += value;
		return true;
	}
	if (type == Game.PHASE_BIDDING) {
		this.players[this.current].declared = value;
		this.current = this.nextPlayer(this.current);
		if (this.current == this.leader) {
			this.phase = Game.PHASE_PLAY;
			this.request |= Game.PHASE_CHANGE;
		}
		return true;
	}
	else {
		if (!this.validMove(value, marriage))
			return false;

		if (marriage) {
			var marryLeft = this.marriageCard(value[0]);
			var marryRight = this.marriageCard(marriage[0]);
			this.extra = this.current;
			this.players[this.current].tricks += this.marriageValue(value, marriage);
			this.totalExtra += this.marriageValue(value, marriage);
			this.players[this.current].marriages[value[0].suit][marryLeft + marryRight] -= value.length;
			this.request |= Game.ADD_EXTRA;
			this.showCards = marriage;
			this.trump = value[0].suit;
			this.trumpChanged = true;
		}
		else
			this.showCards = [];

		if (this.current == this.leader && this.players[this.current].hand.length == this.deal)
			this.request |= Game.FIRST_ORBIT;

		this.players[this.current].removeCards(value);
		this.board[this.current] = value;
		var val = this.boardValue(value);
		console.log('Board value: ' + val.toString(16));
		if (val > this.bestValue) {
			this.bestValue = val;
			this.best = this.current;
		}

		if (this.current === this.best && this.current !== this.leader && this.marriageBest(value)) {
			this.extra = this.current;
			this.request |= Game.CHOOSE_MARRIAGE;
		}

		// add quads points
		if (value.length >= 4 && value.length === this.options.decks && this.current === this.best && this.sameCards(value)) {
			this.extra = this.current;
			this.players[this.current].tricks += this.options.quads_value;
			this.totalExtra += this.options.quads_value;
			this.request |= Game.ADD_EXTRA;
		}

		this.players[this.current].updateMarriages();
		this.current = this.nextPlayer(this.current);
		if (this.current == this.leader) {
			this.players[this.best].tricks += this.board[this.best].length;
			this.current = this.best;
			this.leader = this.best;
			this.bestValue = 0;
			this.request |= Game.NEW_ORBIT;

			if (this.players[this.leader].hand.length == 0) {
				this.phase = Game.PHASE_BIDDING;
				this.deal++;
				this.dealer = this.nextPlayer(this.dealer);
				this.current = this.nextPlayer(this.dealer);
				this.leader = this.current;
				this.request |= Game.NEW_DEAL;
				var player = null;
				while (player = this.playerIter())
					player.addScore(this.calculateScore(player));
				if (this.deal > this.options.deal_end) {
					this.request |= Game.END_GAME;
				}
			}
		}

		return true;
	}
}

Game.prototype.clearBoard = function() {
	for (var i = 0; i < 4; i++) {
		this.lastBoard[i] = this.board[i];
		this.board[i] = [];
	}
}

Game.prototype.calculateScore = function(player) {
	if (player.declared === player.tricks)
		return new Score(this.options.win_value + player.tricks, Score.SUCCESS);
	else if (this.options.handicap && Math.abs(player.declared - player.tricks) === 1)
		return new Score(Math.ceil((this.options.win_value + player.tricks) / 2), Score.HANDICAP);
	else
		return new Score(0, Score.FAIL);
}

Game.prototype.getScores = function() {
	var result = [0, 0, 0, 0];
	for (var i = 0; i < 4; i++)
		if (this.players[i])
			result[i] = this.players[i].scores.slice(-1)[0];
	return result;
}

Game.prototype.getAllScores = function() {
	var result = [];
	for (var i = 0; i < this.deal - this.options.deal_start; i++) {
		var row = [0, 0, 0, 0];
		for (var j = 0; j < 4; j++)
			if (this.players[j])
				row[j] = this.players[j].scores[i];
		result.push(row);
	}
	return result;
}

Game.prototype.getTrickWinner = function() {
	return this.players[this.best];
}

Game.prototype.getExtraPlayer = function() {
	return this.players[this.extra];
}

Game.prototype.onlySuit = function(cards, suit) {
	for (var i = 0; i < cards.length; i++)
		if (cards[i].suit != suit)
			return 0;
	return 1;
}

Game.prototype.sameCards = function(cards) {
	if (cards.length == 1)
		return 1;
	for (var i = 1; i < cards.length; i++)
		if (!cards[i].equals(cards[0]))
			return 0;
	return 1;
}

Game.prototype.suitCount = function(cards, suit) {
	var result = 0;
	for (var i = 0; i < cards.length; i++)
		if (cards[i].suit == suit)
			result++;
	return result;
}

Game.prototype.validMove = function(cards, marriage) {
	// if cards not in hand, move is invalid
	if (!this.players[this.current].inHand(cards)) {
		console.log('Not in hand!');
		return false;
	}

	// if current player is first to act
	if (this.current == this.leader) {
		if (marriage)
			return this.validMarriage(cards, marriage);
		else
			return this.sameCards(cards);
	}

	// move is valid if all played cards match suit that was led
	// or a player played all his cards matching leading suit and some other
	if (marriage)
		return false;

	var suited = this.suitCount(cards, this.leadingSuit());
	return suited == cards.length || suited == this.players[this.current].suitCount(this.leadingSuit());
}

Game.prototype.validMarriage = function(left, right) {
	if (!this.players[this.current].inHand(right)) return false;
	if (!this.sameCards(left) || !this.sameCards(right)) return false;
	if (left[0].suit !== right[0].suit) return false;
	var l = this.marriageCard(left[0]);
	var r = this.marriageCard(right[0]);
	if (!l || !r || l == r) return false;
	return this.players[this.current].marriages[left[0].suit][l + r] >= left.length;
}

Game.prototype.marriageValue = function(left, right) {
	var divBy = (this.marriageCard(left[0]) == Player.JACK || this.marriageCard(right[0]) == Player.JACK) ? 2 : 1;
	return this.suitValue(left[0].suit) * Math.pow(left.length, 2) / divBy;
}

Game.prototype.suitValue = function(suit) {
	if (suit == this.maxValueSuit)
		return this.options.suit_values[this.topCard.suit];
	if (suit == this.topCard.suit)
		return this.options.suit_values[this.maxValueSuit];
	return this.options.suit_values[suit];
}

Game.prototype.howManyQuads = function(playerId) {
	var player = this.players[playerId];
	var result = 0;
	var i = 0;
	for (var j = 1; j < player.hand.length; j++) {
		if (!player.hand[i].equals(player.hand[j]))
			i = j;
		else if (j - i + 1 == this.options.decks) {
			j++;
			i = j;
			result++;
		}
	}
	return result;
}

Game.prototype.maxDeclaration = function(playerId) {
	var player = this.players[playerId];
	var result = this.deal;
	result += this.howManyQuads(playerId) * this.options.quads_value;
	for (var i = 0; i < 4; i++) {
		result += this.suitValue(i) * Math.pow(player.marriages[i][Player.KING + Player.QUEEN], 2);
		if (this.options.half_marriages) {
			result += this.suitValue(i) * Math.pow(player.marriages[i][Player.KING + Player.JACK], 2) / 2;
			result += this.suitValue(i) * Math.pow(player.marriages[i][Player.QUEEN + Player.JACK], 2) / 2;
		}
	}
	return result;
}

Game.prototype.marriageCard = function(card) {
	if (!this.options.marriages)
		return 0;
	if (card.rank == 13) return Player.KING;
	if (card.rank == 12) return Player.QUEEN;
	if (card.rank == 11 && this.options.half_marriages) return Player.JACK;
	return 0;
}

Game.prototype.marriageBest = function(cards) {
	this.marriageOptions = [];
	if (!this.onlySuit(cards, cards[0].suit))
		return false;
	var helper = [0, 0, 0, 3000, 0, 3000, 3000];
	var player = this.players[this.current];
	var suit = cards[0].suit;
	for (var i = 0; i < cards.length; i++) {
		if (cards[i].rank == 13)
			helper[Player.KING]++;
		else if (cards[i].rank == 12)
			helper[Player.QUEEN]++;
		else if (this.options.half_marriages && cards[i].rank == 11)
			helper[Player.JACK]++;
	}
	helper[Player.KING + Player.QUEEN] = Math.min(player.marriages[suit][Player.KING + Player.QUEEN], helper[Player.KING], helper[Player.QUEEN]);
	helper[Player.KING + Player.JACK] = Math.min(player.marriages[suit][Player.KING + Player.JACK], helper[Player.KING], helper[Player.JACK]);
	helper[Player.QUEEN + Player.JACK] = Math.min(player.marriages[suit][Player.QUEEN + Player.JACK], helper[Player.QUEEN], helper[Player.JACK]);
	var full = helper[Player.KING + Player.QUEEN];
	var half = Math.max(helper[Player.KING + Player.JACK], helper[Player.QUEEN + Player.JACK]);
	for (var i = 1; i <= full; i++)
		this.marriageOptions.push(this.suitValue(suit) * Math.pow(i, 2));
	for (var i = 1; i <= half; i++)
		this.marriageOptions.push(this.suitValue(suit) * Math.pow(i, 2) / 2);
	if (this.marriageOptions.length > 0) {
		this.marriageOptions.push(0);
		this.marriageOptions.sort(function(a, b){return a - b});
		console.log(this.marriageOptions);
		return true;
	}
	else
		return false;
}

Game.prototype.getPlayerPlace = function(playerId) {
	var result = 1;
	var myScore = this.players[playerId].getScore();
	for (var i = 0; i < 4; i++)
		if (this.players[i] && this.players[i].getScore() > myScore)
			result++;
	return result;
}

Game.prototype.getReconnectState = function(playerId) {
	var result = {};

	result.myHand = this.players[playerId].hand;
	result.maxBid = this.players[playerId].maxBid;
	result.handSizes = [0, 0, 0, 0];
	result.declared = [0, 0, 0, 0];
	result.tricks = [0, 0, 0, 0];

	for (var i = 0; i < 4; i++)
		if (this.players[i]) {
			result.handSizes[i] = this.players[i].hand.length;
			result.declared[i] = this.players[i].declared;
			result.tricks[i] = this.players[i].tricks;
		}

	result.board = this.board;
	result.lastBoard = this.lastBoard;
	result.current = this.current;
	result.deal = this.deal;
	result.start = this.options.deal_start;
	result.phase = this.phase;
	result.scores = this.getAllScores();
	result.topCard = this.topCard;
	result.trump = this.trump;
	result.trumpChanged = this.trumpChanged;
	result.totalExtra = this.totalExtra;
	result.gameOptions = this.options;

	return result;
}

module.exports = Game;
