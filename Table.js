function Table(id) {
    this.id = id;
    this.playerCount = 0;
    this.players = [undefined, undefined, undefined, undefined];
    this.game = null;
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
    };
}

Table.prototype.findPlayerById = function(playerId) {
    for (var i = 0; i < 4; i++) {
        if (this.players[i] && this.players[i].id == playerId)
            return this.players[i];
    }
    return null;
}

Table.prototype.findPlayerByName = function(playerName) {
    for (var i = 0; i < 4; i++) {
        if (this.players[i] && this.players[i].name == playerName)
            return this.players[i];
    }
    return null;
}

Table.prototype.addPlayer = function(seat, player) {
    if (this.findPlayerById(player.id) || this.findPlayerByName(player.name))
        return false;
    if (this.game && this.game.running)
        return false;
    if (seat >= 0 && seat < 4) {
        if (this.players[seat] != null)
            return false;
        this.players[seat] = player;
        this.playerCount++;
        this.resetReady();
        return true;
    }
    return false;
};

Table.prototype.removePlayer = function(seat) {
    if (seat >= 0 && seat < 4 && this.players[seat] != null) {
        delete this.players[seat];
        this.playerCount--;
        this.resetReady();
        return true;
    }
    return false;
}

Table.prototype.getPlayerNames = function(disconnected) {
    var result = [];
    for (var i = 0; i < 4; i++) {
        if (this.players[i] && (disconnected || this.players[i].connected))
            result.push(this.players[i].name);
        else
            result.push(undefined);
    }
    return result;
}

Table.prototype.playersReady = function() {
    if (this.playerCount < 2)
        return false;
    for (var i = 0; i < 4; i++)
        if (this.players[i] && !this.players[i].ready)
            return false;
    return true;
}

Table.prototype.playersConnected = function() {
    if (this.playerCount < 2)
        return false;
    for (var i = 0; i < 4; i++)
        if (this.players[i] && !this.players[i].connected)
            return false;
    return true;
}

Table.prototype.kickDisconnected = function() {
    for (var i = 0; i < 4; i++)
        if (this.players[i] && !this.players[i].connected) {
            delete this.players[i];
            this.playerCount--;
        }
}

Table.prototype.resetReady = function() {
    for (var i = 0; i < 4; i++)
        if (this.players[i])
            this.players[i].ready = false;
}

module.exports = Table;
