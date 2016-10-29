function Player(id, name, seat, socket) {
    this.id = id;
    this.name = name;
    this.seat = seat;
    this.socket = socket;
    this.ready = false;
    this.connected = true;
    this.admin = false;

    this.hand = [];
    this.declared = 0;
    this.tricks = 0;
    this.scores = [];
    this.cumulated = [];
    this.sequence = null;
    this.marriages = [];
    this.maxBid = 0;
}

Player.KING = 1;
Player.QUEEN = 2;
Player.JACK = 4;

Player.prototype.inHand = function(cards) {
	// cards and this.hand must be sorted!
	if (cards.length == 0)
		return false;
	var j = 0;
	for (var i = 0; i < this.hand.length; i++) {
		if (this.hand[i].equals(cards[j]))
			j++;
		if (j >= cards.length)
			return true;
	}
	return false;
}

Player.prototype.suitCount = function(suit) {
	var result = 0;
	for (var i = 0; i < this.hand.length; i++)
		if (this.hand[i].suit == suit)
			result++;
	return result;
}

Player.prototype.removeCards = function(cards) {
	// cards and this.hand must be sorted!
	var j = 0;
	var newHand = [];
	var compare = true;
	for (var i = 0; i < this.hand.length; i++) {
		if (compare && this.hand[i].equals(cards[j]))
			j++;
		else
			newHand.push(this.hand[i]);

		if (j >= cards.length)
			compare = false;
	}
	this.hand = newHand;
}

Player.prototype.addScore = function(score) {
	this.scores.push(score);
	var lastCumulated = (this.cumulated.length > 0) ? this.cumulated.slice(-1)[0] : 0;
	this.cumulated.push(lastCumulated + score);
}

Player.prototype.resetScores = function() {
	this.scores = [];
	this.cumulated = [];
}

Player.prototype.resetMarriages = function() {
	this.marriages = [
		[0, 0, 0, 1000, 0, 1000, 1000],
		[0, 0, 0, 1000, 0, 1000, 1000],
		[0, 0, 0, 1000, 0, 1000, 1000],
		[0, 0, 0, 1000, 0, 1000, 1000]
	];
}

Player.prototype.getScore = function() {
	if (this.cumulated.length == 0)
		return 0;
	return this.cumulated.slice(-1)[0]
}

Player.prototype.updateMarriages = function() {
	for (var i = 0; i < 4; i++) {
		this.marriages[i][Player.KING] = 0;
		this.marriages[i][Player.QUEEN] = 0;
		this.marriages[i][Player.JACK] = 0;
	}

	for (var i = 0; i < this.hand.length; i++) {
		if (this.hand[i].rank === 13)
			this.marriages[this.hand[i].suit][Player.KING]++;
		else if (this.hand[i].rank === 12)
			this.marriages[this.hand[i].suit][Player.QUEEN]++;
		else if (this.hand[i].rank === 11)
			this.marriages[this.hand[i].suit][Player.JACK]++;
	}

	for (var i = 0; i < 4; i++) {
		this.marriages[i][Player.KING + Player.QUEEN] = Math.min(
			this.marriages[i][Player.KING + Player.QUEEN],
			this.marriages[i][Player.KING],
			this.marriages[i][Player.QUEEN]
		);
		this.marriages[i][Player.KING + Player.JACK] = Math.min(
			this.marriages[i][Player.KING + Player.JACK],
			this.marriages[i][Player.KING],
			this.marriages[i][Player.JACK]
		);
		this.marriages[i][Player.QUEEN + Player.JACK] = Math.min(
			this.marriages[i][Player.QUEEN + Player.JACK],
			this.marriages[i][Player.QUEEN],
			this.marriages[i][Player.JACK]
		);
	}
}

module.exports = Player;
