function Player(id, name, seat, socket) {
    this.id = id;
    this.name = name;
    this.seat = seat;
    this.socket = socket;
    this.ready = false;
    this.connected = true;

    this.hand = [];
    this.declared = 0;
    this.tricks = 0;
    this.scores = [];
    this.cumulated = [];
    this.sequence = null;
}

Player.prototype.inHand = function(cards) {
	// cards and this.hand must be sorted!
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

module.exports = Player;
