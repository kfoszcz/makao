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
		if (this.hand[i] === cards[j])
			j++;
		if (j >= cards.length)
			return true;
	}
	return false;
}

Player.prototype.suitCount = function(suit) {
	var result = 0;
	for (var i = 0; i < hand.length; i++)
		if (hand[i].suit == suit)
			result++;
	return result;
}

module.exports = Player;
