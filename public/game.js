// Card class
var Card = function(suit, rank) {
    this.suit = suit;
    this.rank = rank;
}

// Player class
var Player = function(id, name) {
    this.id = id;
    this.name = name;
}

var Table = function(id) {
    this.id = id;
    this.players = [undefined, undefined, undefined, undefined];
}

Card.suitOrder = [3, 2, 0, 1];

function compareCard(a, b) {
    if (Card.suitOrder[a.suit] == Card.suitOrder[b.suit])
        return b.rank - a.rank;
    else
        return Card.suitOrder[a.suit] - Card.suitOrder[b.suit];
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
