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
    var values = ['', '&nbsp;', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
    var result = document.createElement('div');
    result.className = 'card ' + colors[suit];
    if (my) {
        result.className += ' card-clickable';
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
    $('#waiting').hide();
    $('div.hand').show();
    $('div.tricks').show();
}

function receiveHand(hand) {
    for (var i = 0; i < hand.length; i++)
        $('#hand-south').append(create_card(hand[i]));
    var len = min(hand.length, 10);
    for (var i = 0; i < len; i++) {
        $('#hand-west').append(create_card());
        $('#hand-north').append(create_card());
        $('#hand-east').append(create_card());
    }
}

$(document).ready(function(){
    socket = io();

    socket.on('server-start', function(){
        console.log('restart');
        seatMe(myPreviousSeat);
    });

    socket.on('tableStatus', updateAllNames);

    socket.on('updateTable', updateTable);

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

    socket.on('startGame', startGame);

    $('#chat-input').on('keyup', function(e){
        if (e.keyCode == 13) {
            if (chatSend($(this).val()))
                $(this).val('');
        }
    });

    hands.push(document.getElementById('hand-south'));
    hands.push(document.getElementById('hand-west'));
    hands.push(document.getElementById('hand-north'));
    hands.push(document.getElementById('hand-east'));

    nicks.push($('#nick-south'));
    nicks.push($('#nick-west'));
    nicks.push($('#nick-north'));
    nicks.push($('#nick-east'));

    seatButtons.push($('#button-south'));
    seatButtons.push($('#button-west'));
    seatButtons.push($('#button-north'));
    seatButtons.push($('#button-east'));

    $('#number-value').on('wheel', function(e){
        var delta = e.originalEvent.deltaY;
        if (delta > 0) declareDecrease();
        else declareIncrease();
    });

    $('#number-incr').click(declareIncrease);
    $('#number-decr').click(declareDecrease);
    $('#ready-button').click(playerReady);

    /*var trump_box = $("#trump");
    var trump_cur = $("#trump-current");
    trump_box.append(create_card(trump));
    trump_cur.append(create_card(new Card(trump.suit, 1)));

    $('#desk-south').append(create_card(new Card(1, 2)));
    $('#desk-south').append(create_card(new Card(1, 2)));
    $('#desk-south').append(create_card(new Card(1, 2)));
    // $('#desk-south').append(create_card(new Card(1, 2)));

    $('#desk-west').append(create_card(new Card(1, 3)));
    $('#desk-west').append(create_card(new Card(0, 9)));
    $('#desk-west').append(create_card(new Card(3, 10)));
    // $('#desk-west').append(create_card(new Card(1, 3)));

    $('#desk-north').append(create_card(new Card(1, 4)));
    $('#desk-north').append(create_card(new Card(1, 4)));
    $('#desk-north').append(create_card(new Card(1, 4)));
    // $('#desk-north').append(create_card(new Card(1, 4)));

    $('#desk-east').append(create_card(new Card(1, 5)));
    $('#desk-east').append(create_card(new Card(1, 5)));
    $('#desk-east').append(create_card(new Card(1, 5)));
    // $('#desk-east').append(create_card(new Card(1, 5)));
    
    for (var i = 0; i < hand.length; i++)
        hands[0].appendChild(create_card(hand[i], true));
    for (var p = 1; p < 4; p++)
        for (var i = 0; i < hand.length; i++)
            hands[p].appendChild(create_card());
    // myhand.appendChild(create_card());*/

    $('div.card-clickable').click(function(){
        $(this).css('top', -15 - parseInt($(this).css('top')));
    });
})
