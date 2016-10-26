function create_card(card, my) {
    var result = $('<div class="card"></div>');
    if (card == null)
        result.addClass('facedown');
    else {
        result.addClass('c' + card.suit + '-' + card.rank);
        result.attr('value', card.suit + '-' + card.rank);
    }
    if (my)
        result.addClass('card-clickable');
    return result;

    var colors = ['black', 'red', 'red', 'black', 'facedown'];
    var suits = ['&clubs;', '&diams;', '&hearts;', '&spades;', '&nbsp;'];
    var values = ['', '&nbsp;', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    var result = document.createElement('div');
    result.className = 'card ' + colors[suit];
    // result.className += ' c0-2';
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

function cardClass(card) {
    return 'c' + card.suit + '-' + card.rank;
}

function createScoreHeader() {
    $('.score-table-header').append('<div class="score-row score-header"></div>');
    $('.score-header').append('<div class="score-index">#</div>');
    for (var i = 0; i < 4; i++)
        if (names[i])
            $('.score-header').append('<div class="score-item">' + names[i] + '</div>');
}

function appendScoreRow(scores, deal) {
    if (!scores)
        scores = ['', '', '', ''];
    if (!deal)
        deal = dealNumber;
    var row = $('<div class="score-row"></div>');
    row.append('<div class="score-index">' + deal + '</div>');
    for (var i = 0; i < 4; i++)
        if (names[i])
            row.append('<div class="score-item">' + scores[i] + '</div>');
    $('.score-table').append(row);
    $('.score-window').scrollTop($('.score-window')[0].scrollHeight);
    updateRowWidth();
}

function updateRowWidth() {
    $('.score-table-header').width($('.score-row').last().width());
}

function declareIncrease() {
    var value = parseInt($('#number-value').text());
    value++;
    if (value <= spinnerMax)
        $('#number-value').text(value);
}

function declareDecrease() {
    var value = parseInt($('#number-value').text());
    value--;
    if (value >= 0)
        $('#number-value').text(value);
}

function tricksDecrease(amount) {
    tricksLeft -= amount;
    $('#tricks-remaining').text(tricksLeft);
}

var colors = ['black', 'red', 'red', 'black'];
var suits = ['&clubs;', '&diams;', '&hearts;', '&spades;'];

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
var moveMarriage = null;
var tricks = [];
var board = [];
var lastBoard = [];
var declared = [0, 0, 0, 0];
var currentPlayer = 0;
var selectedCards = [];
var focused = true;
var dealNumber = 0;
var handSizes = [0, 0, 0, 0];
var playFirst = false;
var playLength = 0;
var myTurn = false;
var phase = 0;
var running = false;
var trumpChanged = false;
var totalExtra = 0;
var totalBids = 0;
var tricksLeft = 0;

var spinnerMax = 300000;
var opponentHandLength = 15;

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

function reconnectState(state) {
    $('#ready-button').hide();
    startGame();
    trumpReceive(state.topCard);
    handSizes = state.handSizes;
    phase = state.phase;
    dealNumber = state.deal;
    spinnerMax = state.maxBid;
    if (state.trumpChanged)
        trumpUpdate(state.trump);

    for (var i = 0; i < 4; i++)
        declared[seat(i)] = state.declared[i];

    totalExtra = state.totalExtra;
    for (var i = 0; i < 4; i++)
        if (state.declared[i])
            totalBids += state.declared[i];
    extraUpdate(totalExtra);

    // draw scores, header is drawn by startGame()
    for (var i = 0; i < state.scores.length; i++)
        appendScoreRow(state.scores[i], i + state.start);
    appendScoreRow();

    // draw tricks and hands
    for (var i = 0; i < 4; i++)
        if (names[i]) {
            var tricksText = '-';
            if (state.declared[i] !== null)
                tricksText = state.declared[i];
            if (state.phase == 1)
                tricksText = state.tricks[i] + ' / ' + tricksText;
            tricks[seat(i)].text(tricksText);

            if (i != mySeat)
                drawHand(i, handSizes[i]);
            else
                drawMyHand(state.myHand);
        }
    
    // draw board
    if (state.phase == 1) {
        for (var i = 0; i < 4; i++)
            if (names[i]) {
                drawBoard(i, state.board[i]);
                drawBoard(i, state.lastBoard[i], true);
                playLength = Math.max(playLength, state.board[i].length);
            }
    }

    tricksLeft = $('#hand-south div.card').length + $('#desk-south div.card').length;
    $('#tricks-remaining').text(tricksLeft);
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
    if (playerCount > 1 && seated && !running) {
        $('#ready-button').show();
    }
    else
        $('#ready-button').hide();
}

function updateAllNames(playerNames) {
    for (var i = 0; i < 4; i++)
        updateTable(i, playerNames[i]);
}

// draw functions
function drawHand(player, length) {
    length = Math.min(length, opponentHandLength);
    player = seat(player);
    for (var i = 0; i < length; i++)
        hands[player].append(create_card());
}

function drawMyHand(cards) {
    for (var i = 0; i < cards.length; i++)
        $('#hand-south').append(create_card(cards[i], true));
    $('div.card-clickable').click(cardClicked);
    $('div.card-clickable').hover(cardOver, cardOut);
}

function drawBoard(player, cards, last) {
    player = seat(player);
    for (var i = 0; i < cards.length; i++) {
        if (last)
            lastBoard[player].append(create_card(cards[i]).addClass('board'));
        else
            board[player].append(create_card(cards[i]).addClass('board'));
    }
}

// chat functions
function chatSend(msg) {
    if (msg.length == 0 || msg.length > 300)
        return false;
    // console.log(msg);
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
    $('.score-table-header').empty();
    $('.info').show();
    $('#waiting').hide();
    for (var i = 0; i < 4; i++) {
        if (names[i]) {
            hands[seat(i)].show();
            tricks[seat(i)].show();
        }
    }
    createScoreHeader();
    running = true;
}

function endGame() {
    nicks[currentPlayer].removeClass('current-player');
    $('.number-spinner').hide();
    $('.marriage-window').hide();
    $('.hand').empty();
    $('.hand').hide();
    $('.tricks').hide();
    tricksClear();
    $('#ready-button').show();
    $('#trump').empty();
    $('#trump-current').empty().hide();
    $('.info').hide();
    running = false;
}

function handReceive(hand, maxBid, redeal) {
    $('.hand').empty();
    $('#trump-current').hide();
    trumpChanged = false;
    dealNumber = hand.length;
    spinnerMax = maxBid;
    totalBids = 0;
    tricksLeft = dealNumber;
    $('#tricks-remaining').text(tricksLeft);
    extraUpdate(0);

    drawMyHand(hand);

    for (var i = 0; i < 4; i++)
        if (names[i] && i != mySeat) {
            declared[seat(i)] = 0;
            handSizes[seat(i)] = dealNumber;
            drawHand(i, hand.length);
        }
    tricksClear();
    if (!redeal)
        appendScoreRow();
}

function selectorToCard(selector) {
    var val = $(selector).attr('value').split('-', 2);
    return new Card(parseInt(val[0]), parseInt(val[1]));
}

function marriageCards(card, lower) {
    var marriageRank = 0;
    if (card.rank == 13)
        marriageRank = lower ? 11 : 12;
    else if (card.rank == 12)
        marriageRank = lower ? 11 : 13;
    else if (card.rank == 11)
        marriageRank = lower ? 12 : 13;
    if (marriageRank == 0)
        return null;
    var val = card.suit + '-' + marriageRank;
    return $('#hand-south [value="' + val + '"]');//.addClass('highlighted');
}

function cardOver() {
    $(this).addClass('hovered');
    if ((myTurn && playFirst) || phase == 0) {
        var val = $(this).attr('value');
        $(this).nextAll('[value="' + val + '"]').addClass('hovered');
    }
}

function cardOut() {
    $(this).removeClass('hovered');
    if ((myTurn && playFirst) || phase == 0) {
        var val = $(this).attr('value');
        $(this).nextAll('[value="' + val + '"]').removeClass('hovered');
    }
}

function cardClicked() {
    if (currentPlayer != 0 || phase == 0)
        return;

    var toSend = [];
    var toMarry = [];

    // we are first to act
    if (playFirst) {
        var marriageLength = $('.marriage-lead').length;

        // marriage choose mode
        if (marriageLength) {
            var card = selectorToCard($(this));

            // no marriage
            if ($(this).hasClass('marriage-lead')) {
                $('.marriage-lead').addClass('selected');
                for (var i = 0; i < marriageLength; i++)
                    toSend.push(card);
                moveSend(1, toSend);
            }

            // marriage
            else if ($(this).hasClass('highlighted')) {
                $('.marriage-lead').addClass('selected');
                var lead = selectorToCard($('.marriage-lead').first());
                for (var i = 0; i < marriageLength; i++) {
                    toSend.push(lead);
                    toMarry.push(card);
                }
                moveSend(1, toSend, toMarry);
            }

            // cancelled
            else
                $('.card-clickable').removeClass('highlighted marriage-lead hovered');
        }

        // normal mode
        else {
            var len = $('.hovered').length;
            var card = selectorToCard($('.hovered').first());
            var marriageLow = marriageCards(card, true);
            var marriageHigh = marriageCards(card, false);

            if (marriageLow && marriageLow.length >= len)
                marriageLow.addClass('highlighted');

            if (marriageHigh && marriageHigh.length >= len)
                marriageHigh.addClass('highlighted');

            if ($('.highlighted').length == 0) {
                $('.hovered').addClass('selected');
                for (var i = 0; i < len; i++)
                    toSend.push(card);
                moveSend(1, toSend);
            }

            else {
                $('.hovered').addClass('marriage-lead');
            }
        }
    }
    
    // if we selected required amount of cards, send move
    else {
        $(this).toggleClass('selected');
        if ($('div.selected').length === playLength) {
            $('div.selected').each(function(index){
                toSend.push(selectorToCard($(this)));
            });
            moveSend(1, toSend);
        }
    }

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

function trumpUpdate(suit) {
    $('#trump-current').html('<div class="suit-only ' + colors[suit] + '">' + suits[suit] + '</div>');
    if (!trumpChanged) {
        trumpChanged = true;
        $('#trump div.card').addClass('old-trump');
        $('#trump-current').show();
    }
}

function extraUpdate(value) {
    totalExtra = value;
    $('#declarations-total').text(totalBids - totalExtra);
}

function moveRequest(type, leader) {
    updateCurrentPlayer(mySeat);
    myTurn = true;
    phase = type;
    if (!focused)
        snd.play();
    if (type == 0) {
        $('#number-value').text(Math.floor(dealNumber / playerCount));
        $('.number-spinner').show();
    }
    else if (type == 2) {
        console.log(leader);
        $('.marriage-option').remove();
        for (var i = 0; i < leader.length; i++)
            $('.marriage-window').append('<div class="marriage-option">' + leader[i] + '</div>');
        $('.marriage-option').click(function(){
            moveSend(2, parseInt($(this).text()));
        });
        $('.marriage-window').show();
    }
    else {
        playFirst = leader;
        $(':hover').last().trigger('mouseenter');
    }

}

function moveSend(type, value, marriage) {
    moveType = type;
    moveValue = value;
    moveMarriage = marriage;
    socket.emit('moveSend', type, value, marriage);
}

function moveOK(result) {
    if (!result) {
        $('.card-clickable').removeClass('selected hovered marriage-lead highlighted');
        $(':hover').last().trigger('mouseleave');
        return;
    }
    myTurn = false;
    if (moveType == 0) {
        $('.number-spinner').hide();
        tricks[0].text(moveValue);
        declared[0] = moveValue;
        totalBids += moveValue;
        $('#declarations-total').text(totalBids);
    }
    else if (moveType == 2) {
        $('.marriage-window').hide();
    }
    else {
        board[0].append($('div.selected'));
        $('.card.selected').addClass('board');
        $('.card.board').removeClass('selected hovered card-clickable marriage-lead highlighted');
        $('.card-clickable').removeClass('highlighted');
        if (moveMarriage)
            trumpUpdate(moveMarriage[0].suit);
    }
    $('.card.hovered').removeClass('hovered');
}

function moveReceive(player, type, value, marriage) {
    player = seat(player)
    if (type == 0) {
        tricks[player].text(value);
        declared[player] = value;
        totalBids += value;
        $('#declarations-total').text(totalBids);
    }
    else {
        playLength = value.length;
        for (var i = 0; i < value.length; i++) {
            board[player].append(create_card(value[i]).addClass('board'));
            handSizes[player]--;
            if (handSizes[player] < opponentHandLength)
                hands[player].children().last().remove();
        }
        if (marriage) {
            trumpUpdate(marriage[0].suit);
            var len = Math.min(handSizes[player], opponentHandLength);
            var begin = Math.floor((len - marriage.length) / 2);
            for (var i = 0; i < marriage.length; i++) {
                hands[player].children().eq(begin + i).addClass('show ' + cardClass(marriage[i]));
                hands[player].children().eq(begin + i).removeClass('facedown');
            }
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
    $('.desk-last .desk-board').empty();
    $('#desk-east-last').append($('#desk-east').children());
    $('#desk-north-last').append($('#desk-north').children());
    $('#desk-west-last').append($('#desk-west').children());
    $('#desk-south-last').append($('#desk-south').children());

    tricksDecrease($('#desk-south .card').length);
    $('.desk .desk-board').empty();
    $('.card.show').attr('class', 'card facedown');
}

$(document).ready(function(){
    // card faces test
    
    /*for (var i = 0; i < 4; i++)
        for (var j = 2; j < 15; j++)
            $('#hand-south').append(create_card(new Card(i, j)));
    $('#button-south').hide();
    $('#hand-south').show();
    return;*/
    
    socket = io();

    $('#username').focus();



    /*$('#hand-south').append(create_card(new Card(2, 6), true));
    $('#hand-south').append(create_card(new Card(2, 6), true));
    $('#hand-south').append(create_card(new Card(2, 6), true));
    $('#hand-south').append(create_card(new Card(3, 8), true));
    $('#hand-south').append(create_card(new Card(3, 8), true));
    $('div.card-clickable').click(cardClicked);
    $('div.card-clickable').hover(cardOver, cardOut);
    $('#hand-south').show();*/

    $(window).blur(function(){
        focused = false;
    });

    $(window).focus(function(){
        focused = true;
    });

    $(window).resize(updateRowWidth);

    socket.on('tableStatus', updateAllNames);

    socket.on('updateTable', updateTable);

    socket.on('tricksUpdate', tricksUpdate);

    socket.on('extraUpdate', extraUpdate);

    socket.on('tricksInit', tricksInit);

    socket.on('updateCurrentPlayer', updateCurrentPlayer);

    socket.on('clearBoard', clearBoard);

    socket.on('reconnectState', reconnectState);

    socket.on('ding', function(){
        if (!focused)
            snd.play();
    });

    socket.on('scoresUpdate', function(scores){
        $('.score-row').last().remove();
        appendScoreRow(scores);
    });

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

    lastBoard.push($('#desk-south-last'));
    lastBoard.push($('#desk-west-last'));
    lastBoard.push($('#desk-north-last'));
    lastBoard.push($('#desk-east-last'));

    $('#last-trick').click(function(){
        $('.desk-last').show();
    });

    $('.desk-close').click(function(){
        $('.desk-last').hide();
    });

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
