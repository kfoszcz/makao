function Deck(quantity) {
	this.marker = 0;
	this.deck = [];
	while (quantity--)
	    for (var i = 0; i < 4; i++)
	        for (var j = 2; j < 15; j++)
	            deck.push(new Card(i, j));
}

Deck.prototype.shuffle = function() {
	var i = this.deck.length, j, tmp;
	while (--i) {
	    j = Math.floor(Math.random() * (i + 1));
	    tmp = this.deck[j];
	    this.deck[j] = this.deck[i];
	    this.deck[i] = tmp;
	}
	this.marker = 0;
}

Deck.prototype.draw = function(amount) {
	marker += amount;
	return this.deck.slice(marker - amount, marker);
}

Deck.prototype.size = function() {
	return this.deck.length - marker;
}

module.exports = Deck;
