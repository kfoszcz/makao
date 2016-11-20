var socket = null;

function createRow(table) {
	var row = $('<tr class="tables-row" id="table-' + table.id + '"></tr>');
	row.append($('<td class="tables-id">' + table.id + '</td>'));
	for (var i = 0; i < 4; i++) {
		if (table.players[i])
			row.append($('<td class="tables-item">' + table.players[i] + '</td>'));
		else
			row.append($('<td class="tables-item">-</td>'));
	}
	row.click(function(){
		window.open('/table/' + table.id, '_blank');
	});
	return row;
}

function updateAllTables(tables) {
	$('#tables tr.tables-row').remove();
	for (var i = 0; i < tables.length; i++)
		$('#tables').append(createRow(tables[i]));
}

function updateTable(id, seat, name) {
	name = (name) ? name : '-';
	$('#tables tr#table-' + id + ' td.tables-item').eq(seat).text(name);
}

$(document).ready(function(){

	socket = io('/lobby');
	socket.emit('hello');

	$('#new-table').click(function(){
		socket.emit('newTable');
	});

	socket.on('tablesStatus', updateAllTables);
	socket.on('updateTable', updateTable);

});
