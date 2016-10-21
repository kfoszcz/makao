function Card(suit, rank) {
    this.suit = suit;
    this.rank = rank;
}

Card.prototype.equals = function(other) {
    return this.suit === other.suit && this.rank === other.rank;
}

Card.prototype.print = function() {
    return Card.ranks[this.rank] + Card.suits[this.suit];
}

Card.suitOrder = [3, 2, 0, 1];
Card.suits = ['C', 'D', 'H', 'S'];
Card.ranks = ['', '', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

function compareCard(a, b) {
    if (Card.suitOrder[a.suit] == Card.suitOrder[b.suit])
        return b.rank - a.rank;
    else
        return Card.suitOrder[a.suit] - Card.suitOrder[b.suit];
}

Card.sortCards = function(hand) {
    hand.sort(compareCard);
    return hand;
}

function shuffleDeck(deck) {
    var i = deck.length, j, tmp;
    while (--i) {
        j = Math.floor(Math.random() * (i + 1));
        tmp = deck[j];
        deck[j] = deck[i];
        deck[i] = tmp;
    }
}

function createDeck(quantity) {
    var deck = [];
    while (quantity--)
        for (var i = 0; i < 4; i++)
            for (var j = 2; j < 15; j++)
                deck.push(new Card(i, j));
    return deck;
}

module.exports = Card;
