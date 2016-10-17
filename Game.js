var Player = require('./Player.js');
var Deck = require('./Deck.js');
var Card = require('./Card.js');

function Game(players) {
	this.options = {
		'deal_start': 8,
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
	}
	this.playersCount = 0;
	this.seats = [];
	this.phase = Game.PHASE_BIDDING;
	this.deal = this.options.deal_start;
	this.dealer = null;
	this.leader = null;
	this.current = null;
	this.topCard = null;
	this.paused = true;
	this.deck = new Deck(this.options.decks);
	this.trump = null;
	this.board = [[], [], [], []];
	this.best = null;
	this.bestValue = 0;
	this.players = players;
	this.iter = 0;
}

Game.PHASE_BIDDING = 0;
Game.PHASE_PLAY = 1;

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

Game.prototype.nextPlayer = function() {
	var index = this.current;
	do {
		index = (index + 1) % 4;
	} while (!this.players[index]);
	return index;
}

Game.prototype.init = function() {
	for (var i = 0; i < 4; i++)
		if (this.players[i]) {
			this.players[i].sequence = this.playersCount++;
			this.seats.push(i);
		}
	var rnd = Math.floor(Math.random() * this.playersCount);
	this.dealer = this.seats[rnd];
	this.leader = this.nextPlayer(this.dealer);
	this.current = this.leader;
	this.deck.shuffle();
}

Game.prototype.dealCards = function() {
	var cardsNeeded = this.playersCount * this.deal + 1;
	if (this.options.always_shuffle || cardsNeeded > this.deck.size())
		this.deck.shuffle();

	for (var i = 0; i < this.playersCount; i++)
		this.players[this.seats[i]].hand = Card.sortCards(this.deck.draw(this.deal));

	this.topCard = this.deck.draw(1)[0];
	this.trump = this.topCard.suit;
}

Game.prototype.boardValue = function(cards) {
	var shift = 0;
	var result = 0;
	for (var i = cards.length - 1; i >= 0; i--) {
		result |= cards[i].rank << shift;
		shift += 4;
	}
	result |= this.sameCards(cards) << shift++;
	result |= this.onlySuit(cards, this.leadingSuit()) << shift++;
	result |= this.onlySuit(cards, this.trump) << shift++;
	return result;
}

Game.prototype.move = function(type, value) {
	if (type == Game.PHASE_BIDDING) {
		this.players[this.current].declared = value;
		this.current = this.nextPlayer(this.current);
		if (this.current == this.leader)
			this.phase = Game.PHASE_PLAY;
		return true;
	}
	else {
		return false;
		if (!this.validMove(value))
			return false;
		// this.players[this.current].removeCards(value);
	}
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
		if (cards[i] !== cards[0])
			return 0;
	return 1;
}

Player.prototype.suitCount = function(cards, suit) {
	var result = 0;
	for (var i = 0; i < cards.length; i++)
		if (cards[i].suit == suit)
			result++;
	return result;
}

Game.prototype.validMove = function(cards) {
	// if cards not in hand, move is invalid
	if (!this.players[this.current].inHand(cards))
		return false;

	// if current player is first to act, move is always valid
	if (this.current == this.leader)
		return true;

	// move is valid if all played cards match suit that was led
	// or a player played all his cards matching leading suit and some other
	var suited = this.suitCount(cards, this.leadingSuit());
	return suited == cards.length || suited == this.players[this.current].suitCount(this.leadingSuit());
}

module.exports = Game;
