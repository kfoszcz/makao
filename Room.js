var Table = require('./Table.js');

function Room(id, maxTables) {
	this.id = id;
	this.maxTables = maxTables;
	this.tableCount = 0;
	this.tables = [];
	for (var i = 0; i <= maxTables; i++)
		this.tables.push(null);
}

Room.prototype.addTable = function() {
	if (this.tableCount == this.maxTables)
		return false;

	var free = 1;
	while (this.tables[free])
		free++;

	this.tables[free] = new Table(free);
	this.tableCount++;
	return this.tables[free];
};

Room.prototype.removeTable = function(id) {
	if (this.tables[id]) {
		delete this.tables[id];
		this.tableCount--;
	}
};

Room.prototype.removeEmptyTables = function() {
	for (var i = 1; i <= this.maxTables; i++)
		if (this.tables[i] && this.tables[i].playerCount == 0)
			this.removeTable(i);
};

Room.prototype.getTablesStatus = function() {
	var result = [];
	for (var i = 1; i <= this.maxTables; i++)
		if (this.tables[i]) {
			result.push({
				'id': i,
				'playing': (this.tables[i].game) ? this.tables[i].game.running : false,
				'players': this.tables[i].getPlayerNames()
			});
		}
	return result;
};

Room.prototype.getTable = function(id) {
	if (id < 1 || id > this.maxTables || !this.tables[id])
		return null;
	return this.tables[id];
};

module.exports = Room;
