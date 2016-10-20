function create_card(card, my) {
    if (card == null) {
        suit = 4;
        value = 1;
    }
    else {
        suit = card.suit;
        value = card.rank;
    }
    var colors = ['black', 'red', 'red', 'black', 'facedown'];
    var suits = ['&clubs;', '&diams;', '&hearts;', '&spades;', '&nbsp;'];
    var values = ['', '&nbsp;', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    var result = document.createElement('div');
    result.className = 'card ' + colors[suit];
    if (my) {
        result.className += ' card-clickable';
        result.setAttribute('value', suit + '-' + value);
    }
    var topleft = document.createElement('div');
    var bottomright = document.createElement('div');
    var central = document.createElement('div');
    topleft.className = 'topleft';
    bottomright.className = 'bottomright';
    central.className = 'center';
    if (value > 1) {
        topleft.innerHTML = values[value] + '<br>' + suits[suit];
        bottomright.innerHTML = values[value] + '<br>' + suits[suit];
    }
    central.innerHTML = suits[suit];
    result.appendChild(topleft);
    result.appendChild(central);
    result.appendChild(bottomright);
    return result;
}

function createScoreHeader() {
    $('.score-table').append('<div class="score-row score-header"></div>');
    $('.score-header').append('<div class="score-index">#</div>');
    for (var i = 0; i < 4; i++)
        if (names[i])
            $('.score-header').append('<div class="score-item">' + names[i] + '</div>');
}

function appendScoreRow(scores) {
    var row = $('<div class="score-row"></div>');
    row.append('<div class="score-index">' + dealNumber + '</div>');
    for (var i = 0; i < 4; i++)
        if (names[i])
            row.append('<div class="score-item">' + scores[i] + '</div>');
    $('.score-table').append(row);
    $('.score-window').scrollTop($('.score-window')[0].scrollHeight);
}

function declareIncrease() {
    var value = parseInt($('#number-value').text());
    value++;
    $('#number-value').text(value);
}

function declareDecrease() {
    var value = parseInt($('#number-value').text());
    value--;
    if (value >= 0)
        $('#number-value').text(value);
}

var socket = null;
var mySeat = 0;
var myPreviousSeat = -1;
var seated = false;
var names = [];
var nicks = [];
var seatButtons = [];
var playerCount = 0;
var cards = [];
var hands = [];
var moveType = null;
var moveValue = null;
var tricks = [];
var board = [];
var declared = [0, 0, 0, 0];
var currentPlayer = 0;
var selectedCards = [];
var focused = true;
var dealNumber = 0;
var handSizes = [0, 0, 0, 0];

var snd = new Audio('notification.mp3');

function seat(place) {
    return (4 + place - mySeat) % 4;
}

function seatMe(place) {
    if ($('#username').val()) {
        socket.emit('seatRequest', place, $('#username').val());
        mySeat = place;
        names[place] = $('#username').val();
    }
}

function countPlayers() {
    var result = 0;
    for (var i = 0; i < 4; i++)
        if (names[i] != null)
            result++;
    return result;
}

function updateTable(position, name) {
    var pos = seat(position);
    if (name != null) {
        names[position] = name;
        nicks[pos].text(name);
        seatButtons[pos].hide();
        nicks[pos].show();
    }
    else {
        names[position] = null;
        nicks[pos].text('---');
        if (position == mySeat && seated) {
            seated = false;
            myPreviousSeat = mySeat;
            mySeat = 0;
            updateAllNames(names);
            $('#username-request').show();
            return;
        }
        if (!seated) {
            nicks[pos].hide();
            seatButtons[pos].show();
        }
        else {
            seatButtons[pos].hide();
            nicks[pos].show();
        }
    }
    playerCount = countPlayers();
    $('#waiting').hide();
    if (playerCount > 1 && seated) {
        $('#ready-button').show();
    }
    else
        $('#ready-button').hide();
}

function updateAllNames(playerNames) {
    for (var i = 0; i < 4; i++)
        updateTable(i, playerNames[i]);
}

// chat functions
function chatSend(msg) {
    if (msg.length == 0 || msg.length > 300)
        return false;
    console.log(msg);
    socket.emit('chatMsg', msg);
    return true;
}

function chatReceive(msg, sender) {
    if (sender) {
        $('#chat-history').append('<p><span class="chat-nick">' + sender + ': </span><span class="chat-msg">' + msg + '</span></p>');
    }
    else {
        $('#chat-history').append('<p><span class="chat-server">' + msg + '</span></p>');
    }
    $('#chat-history').scrollTop($('#chat-history')[0].scrollHeight);
}

function playerReady() {
    $('#ready-button').hide();
    $('#waiting').show();
    socket.emit('playerReady');
}

function startGame() {
    $('.score-table').empty();
    $('#waiting').hide();
    for (var i = 0; i < 4; i++) {
        if (names[i]) {
            hands[seat(i)].show();
            tricks[seat(i)].show();
        }
    }
    createScoreHeader();
}

function endGame() {
    nicks[currentPlayer].removeClass('current-player');
    for (var i = 0; i < 4; i++) {
        if (names[i]) {
            hands[seat(i)].hide();
            tricks[seat(i)].hide();
        }
    }
    $('#ready-button').show();
    $('#trump').empty();
}

function handReceive(hand) {
    dealNumber = hand.length;
    for (var i = 0; i < hand.length; i++)
        $('#hand-south').append(create_card(hand[i], true));
    $('div.card-clickable').click(cardClicked);
    var len = Math.min(hand.length, 10);
    for (var i = 0; i < 4; i++)
        if (names[i] && i != mySeat)
            for (var j = 0; j < len; j++) {
                hands[seat(i)].append(create_card());
                declared[seat(i)] = 0;
                handSizes[seat(i)] = dealNumber;
            }
    tricksClear();
}

function cardClicked() {
    if (currentPlayer != 0)
        return;
    // $(this).css('top', -15 - parseInt($(this).css('top')));
    selectedCards = [];
    selectedCards.push($(this));
    // console.log(selectedCards);
    var toSend = [];
    for (var i = 0; i < selectedCards.length; i++) {
        var val = selectedCards[i].attr('value').split('-', 2);
        toSend.push(new Card(parseInt(val[0]), parseInt(val[1])));
    }
    moveSend(1, toSend);
}

function tricksUpdate(player, value) {
    player = seat(player);
    tricks[player].text(value + ' / ' + declared[player]);
}

function tricksInit() {
    for (var i = 0; i < 4; i++)
        if (names[i])
            tricks[seat(i)].text('0 / ' + declared[seat(i)]);
}

function tricksClear() {
    for (var i = 0; i < 4; i++)
        tricks[i].text('-');
}

function trumpReceive(card) {
    $('#trump').html(create_card(card));
}

function moveRequest(type) {
    updateCurrentPlayer(mySeat);
    if (!focused)
        snd.play();
    if (type == 0) {
        $('.number-spinner').show();
    }
}

function moveSend(type, value) {
    moveType = type;
    moveValue = value;
    socket.emit('moveSend', type, value);
}

function moveOK(result) {
    if (!result)
        return;
    if (moveType == 0) {
        $('.number-spinner').hide();
        tricks[0].text(moveValue);
        declared[0] = moveValue;
    }
    else {
        board[0].append(selectedCards);
        selectedCards = [];
    }
}

function moveReceive(player, type, value) {
    player = seat(player)
    if (type == 0) {
        tricks[player].text(value);
        declared[player] = value;
    }
    else {
        for (var i = 0; i < value.length; i++) {
            board[player].append(create_card(value[i]));
            handSizes[player]--;
            if (handSizes[player] < 10)
                hands[player].children().last().remove();
        }
    }
}

function updateCurrentPlayer(player) {
    player = seat(player);
    nicks[currentPlayer].removeClass('current-player');
    nicks[player].addClass('current-player');
    currentPlayer = player;
}

function clearBoard() {
    $('.desk-board').empty();
}

$(document).ready(function(){
    socket = io();

    socket.on('server-start', function(){
        console.log('restart');
        seatMe(myPreviousSeat);
    });

    $(window).blur(function(){
        focused = false;
    });

    $(window).focus(function(){
        focused = true;
    });

    socket.on('tableStatus', updateAllNames);

    socket.on('updateTable', updateTable);

    socket.on('tricksUpdate', tricksUpdate);

    socket.on('tricksInit', tricksInit);

    socket.on('updateCurrentPlayer', updateCurrentPlayer);

    socket.on('clearBoard', clearBoard);

    socket.on('scoresUpdate', appendScoreRow);

    socket.on('seatResponse', function(response){
        if (response) {
            seated = true;
            $('#username-request').hide();
            updateAllNames(names);
        }
        else {
            names[mySeat] = null;
            mySeat = 0;
        }
    });

    socket.on('chatReceive', chatReceive);
    socket.on('handReceive', handReceive);
    socket.on('moveReceive', moveReceive);
    socket.on('moveRequest', moveRequest);
    socket.on('trumpReceive', trumpReceive);
    socket.on('moveOK', moveOK);

    socket.on('startGame', startGame);
    socket.on('endGame', endGame);

    $('#chat-input').on('keyup', function(e){
        if (e.keyCode == 13) {
            if (chatSend($(this).val()))
                $(this).val('');
        }
    });

    hands.push($('#hand-south'));
    hands.push($('#hand-west'));
    hands.push($('#hand-north'));
    hands.push($('#hand-east'));

    nicks.push($('#nick-south'));
    nicks.push($('#nick-west'));
    nicks.push($('#nick-north'));
    nicks.push($('#nick-east'));

    tricks.push($('#tricks-south'));
    tricks.push($('#tricks-west'));
    tricks.push($('#tricks-north'));
    tricks.push($('#tricks-east'));

    seatButtons.push($('#button-south'));
    seatButtons.push($('#button-west'));
    seatButtons.push($('#button-north'));
    seatButtons.push($('#button-east'));

    board.push($('#desk-south'));
    board.push($('#desk-west'));
    board.push($('#desk-north'));
    board.push($('#desk-east'));

    $('#number-value').on('wheel', function(e){
        var delta = e.originalEvent.deltaY;
        if (delta > 0) declareDecrease();
        else declareIncrease();
    });

    $('#number-incr').click(declareIncrease);
    $('#number-decr').click(declareDecrease);
    $('#ready-button').click(playerReady);

    $('#number-ok').click(function(){
        if (currentPlayer == 0) {
            var value = parseInt($('#number-value').text());
            moveSend(0, value);
        }
    });

})
