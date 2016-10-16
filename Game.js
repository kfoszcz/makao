function Game(players) {
	this.options = {
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
	this.deck = new Deck(options.decks);
	this.trump = null;
	this.board = [[], [], [], []];
	this.best = null;
	this.bestValue = 0;
	this.players = players;
}

Game.PHASE_BIDDING = 0;
Game.PHASE_PLAY = 1;

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

Game.prototype.deal = function() {
	var cardsNeeded = this.playersCount * this.deal + 1;
	if (this.options.always_shuffle || cardsNeeded > this.deck.size())
		this.deck.shuffle();

	for (var i = 0; i < this.playersCount; i++)
		players[this.seats[i]].hand = sortCards(this.deck.draw(this.deal));

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

module.exports = Game;
