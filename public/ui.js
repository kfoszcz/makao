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
}

function cardClass(card) {
    return 'c' + card.suit + '-' + card.rank;
}

function createScoreHeader() {
    $('.score-table-header').append('<div class="score-row score-header"></div>');
    $('.score-header').append('<div class="score-index">#</div>');
    for (var i = 0; i < 4; i++)
        if (names[i])
            $('.score-header').append('<div class="score-item score-item-header">' + names[i] + '</div>');
}

function appendScoreRow(scores, deal) {
    if (!deal)
        deal = dealNumber;
    var row = $('<div class="score-row"></div>');
    row.append('<div class="score-index">' + deal + '</div>');
    if (!scores) {
        for (var i = 0; i < 4; i++)
            if (names[i]) {
                row.append('<div class="score-info"><span class="score-declared"></span><br><span class="score-taken">&nbsp;</span></div>');
                row.append('<div class="score-item"></div>');
            }
    }
    else {
        for (var i = 0; i < 4; i++)
            if (names[i]) {
                row.append('<div class="score-info"><span class="score-declared">' + scores[i].declared
                    + '</span><br><span class="score-taken ' + scoreClasses[scores[i].type]
                    + '">' + scores[i].tricks + '</span></div>');
                row.append('<div class="score-item">' + scores[i].cumulated + '</div>');
            }
    }
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

var mobile = false;
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
var gameOptions = null;
var maxValueSuit = 0;
var scoreClasses = [
    'score-fail',
    'score-handicap',
    'score-success'
];

var spinnerMax = 300000;
var opponentHandLength = 15;
var initialTrump = 0;

// marriage mode variables
var marriageMode = false;
var marriageHigh = null;
var marriageLow = null;
var prevCard = null;

var snd = new Audio('/notification.mp3');

function seat(place) {
    return (4 + place - mySeat) % 4;
}

function seatMe(place) {
    if ($('#username').val()) {
        socket.emit('seatRequest', place, $('#username').val());
    }
}

function suitValue(suit) {
    if (suit == maxValueSuit)
        return gameOptions.suit_values[initialTrump];
    if (suit == initialTrump)
        return gameOptions.suit_values[maxValueSuit];
    return gameOptions.suit_values[suit];
}

function marriageValue(suit, len, half) {
    var divBy = half ? 2 : 1;
    return suitValue(suit) * Math.pow(len, 2) / divBy;
}

function trickStatusText(value) {
    if (value == 0)
        return 'Na równo';
    if (value > 0)
        return 'Do walki: ' + value;
    else
        return 'Do sprzedania: ' + -value;
}

function updateGameOptions(options) {
    gameOptions = options;
    $('#options-start').val(gameOptions.deal_start);
    $('#options-end').val(gameOptions.deal_end);
    $('#options-decks').val(gameOptions.decks);
    $('#options-quads').val(gameOptions.quads_value);
    $('#options-winvalue').val(gameOptions.win_value);
    $('#options-marriages').prop('checked', gameOptions.marriages);
    $('#options-half').prop('checked', gameOptions.half_marriages);
    $('#options-shuffle').prop('checked', gameOptions.always_shuffle);
    $('#options-handicap').prop('checked', gameOptions.handicap);

    if (!running && countPlayers() >= 2) {
        $('#waiting').hide();
        $('#ready-button').show();
    }
}

function submitGameOptions() {
    socket.emit('optionsChange', {
        'deal_start': parseInt($('#options-start').val()),
        'deal_end': parseInt($('#options-end').val()),
        'decks': parseInt($('#options-decks').val()),
        'quads_value': parseInt($('#options-quads').val()),
        'win_value': parseInt($('#options-winvalue').val()),
        'marriages': $('#options-marriages').prop('checked'),
        'half_marriages': $('#options-half').prop('checked'),
        'always_shuffle': $('#options-shuffle').prop('checked'),
        'handicap': $('#options-handicap').prop('checked')
    });
    focusChat();
    $('.options').hide();
}

function reconnectState(state) {
    $('#ready-button').hide();
    startGame(state.gameOptions);
    trumpReceive(state.topCard);
    handSizes = state.handSizes;
    updatePhase(state.phase);
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
    $('#declarations-total').text(totalBids + ' / ' + dealNumber);
}

function countPlayers() {
    var result = 0;
    for (var i = 0; i < 4; i++)
        if (names[i])
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

function updatePhase(phaseId) {
    phase = phaseId;
    if (phase == 0) {
        $('.info-2').hide();
        $('.info-1').show();
    }
    else {
        $('.info-1').hide();
        $('.info-2').show();
        extraUpdate(0);
    }
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

function startGame(options) {
    running = true;
    updateGameOptions(options);
    var bestVal = 0;
    for (var i = 0; i < 4; i++)
        if (options.suit_values[i] > bestVal) {
            maxValueSuit = i;
            bestVal = options.suit_values[i];
        }

    $('.score-table').empty();
    $('.score-table-header').empty();
    updatePhase(0);
    $('#waiting').hide();
    $('#stand-button').hide();
    $('#options-button').hide();
    $('.info-all').show();
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
    $('.number-spinner').hide();
    $('.marriage-window').hide();
    $('.hand').empty();
    $('.hand').hide();
    $('.tricks').hide();
    tricksClear();
    $('#ready-button').show();
    $('#stand-button').show();
    $('#options-button').show();
    $('#trump').empty();
    $('#trump-current').empty().hide();
    $('.info').hide();
    $('.nick.disconnected').removeClass('disconnected');
    running = false;
}

function handReceive(hand, maxBid, redeal) {
    $('.hand').empty();
    $('#trump-current').hide();
    updatePhase(0);
    trumpChanged = false;
    dealNumber = hand.length;
    spinnerMax = maxBid;
    totalBids = 0;
    tricksLeft = dealNumber;
    $('#tricks-remaining').text(tricksLeft);
    $('#declarations-total').text('0 / ' + dealNumber);
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
    if (lower && !gameOptions.half_marriages)
        return [];
    var marriageRank = 0;
    if (card.rank == 13)
        marriageRank = lower ? 11 : 12;
    else if (card.rank == 12)
        marriageRank = lower ? 11 : 13;
    else if (card.rank == 11 && gameOptions.half_marriages)
        marriageRank = lower ? 12 : 13;
    if (marriageRank == 0)
        return [];
    var val = card.suit + '-' + marriageRank;
    return $('#hand-south [value="' + val + '"]');//.addClass('highlighted');
}

function cardRankName(rank) {
    if (rank == 13)
        return 'króli';
    else if (rank == 12)
        return 'dam';
    else if (rank == 11)
        return 'waletów';
    return false;
}

function cardCountName(count) {
    if (count == 2)
        return 'parą';
    else if (count == 3)
        return 'trójką';
    else if (count == 4)
        return 'czwórką';
    return false;
}

function enterMarriageMode(confirmation) {
    marriageMode = true;
    var toSend = [];
    var toMarry = [];
    $('#desk-south div.card').addClass('board');
    $('div.card.board').removeClass('hovered');
    var marriageLength = $('#desk-south div.card').length;
    var card = selectorToCard($('#desk-south div.card').first());
    $('.marriage-no').off();
    $('.marriage-yes').remove();
    if (confirmation) {
        $('.marriage-choose .marriage-description').text('Masz meldunek w tym kolorze. Czy mimo to chcesz zagrać '
            + cardCountName(marriageLength) + ' ' + cardRankName(card.rank) + '?');
        $('.marriage-no').text('Tak');
        $('.marriage-cancel').text('Nie');
    }
    else {
        $('.marriage-choose .marriage-description').text('Wybierz opcję:');
        $('.marriage-no').text('Nie melduj');
        $('.marriage-cancel').text('Cofnij');
        if (marriageHigh.length >= marriageLength && card.rank > 11)
            $('.marriage-no').before('<div class="marriage-cloud marriage-yes marriage-high">Zamelduj ' + marriageValue(card.suit, marriageLength, false) + '</div>');
        if (marriageHigh.length >= marriageLength && card.rank == 11)
            $('.marriage-no').before('<div class="marriage-cloud marriage-yes marriage-high">Zamelduj ' + marriageValue(card.suit, marriageLength, true) + '</div>');
        if (marriageLow.length >= marriageLength)
            $('.marriage-no').before('<div class="marriage-cloud marriage-yes marriage-low">Zamelduj ' + marriageValue(card.suit, marriageLength, true) + '</div>');
    }
    $('.marriage-yes').hover(function(){
        if ($(this).hasClass('marriage-high'))
            marriageHigh.slice(0, marriageLength).addClass('hovered');
        else
            marriageLow.slice(0, marriageLength).addClass('hovered');
    }, function(){
        if ($(this).hasClass('marriage-high'))
            marriageHigh.slice(0, marriageLength).removeClass('hovered');
        else
            marriageLow.slice(0, marriageLength).removeClass('hovered');
    });
    $('.marriage-yes').click(function(){
        var marry = selectorToCard('div.card.hovered');
        for (var i = 0; i < marriageLength; i++) {
            toSend.push(card);
            toMarry.push(marry);
        }
        moveSend(1, toSend, toMarry);
    });
    $('.marriage-no').click(function(){
        for (var i = 0; i < marriageLength; i++)
            toSend.push(card);
        moveSend(1, toSend);
    });
    $('.marriage-choose').show();
}

function marriageBack() {
    $('#desk-south div.card').removeClass('board');
    if (prevCard.length)
        prevCard.after($('#desk-south div.card'));
    else
        $('#hand-south').prepend($('#desk-south div.card'));

    $('.marriage-choose').hide();
    marriageMode = false;
}

function cardOver() {
    if (marriageMode)
        return;
    $(this).addClass('hovered');
    if ((myTurn && playFirst) || phase == 0) {
        var val = $(this).attr('value');
        $(this).nextAll('[value="' + val + '"]').addClass('hovered');
    }
}

function cardOut() {
    if (marriageMode)
        return;
    $(this).removeClass('hovered');
    if ((myTurn && playFirst) || phase == 0) {
        var val = $(this).attr('value');
        $(this).nextAll('[value="' + val + '"]').removeClass('hovered');
    }
}

function cardClicked() {
    if (currentPlayer != 0 || phase == 0 || marriageMode)
        return;

    var toSend = [];
    var toMarry = [];

    // we are first to act
    if (playFirst) {
        var len = $('#hand-south .hovered').length;
        var card = selectorToCard($('#hand-south .hovered').first());
        marriageLow = gameOptions.marriages ? marriageCards(card, true) : [];
        marriageHigh = gameOptions.marriages ? marriageCards(card, false) : [];

        if (!marriageLow.length && !marriageHigh.length) {
            $('.hovered').addClass('selected');
            for (var i = 0; i < len; i++)
                toSend.push(card);

            // show confirmation
            moveSend(1, toSend);
        }

        else {
            var confirmation = (marriageLow.length < len && marriageHigh.length < len);
            prevCard = $('#hand-south .hovered').first().prev();
            $('#desk-south').append($('#hand-south .hovered'));
            enterMarriageMode(confirmation);
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
    initialTrump = card.suit;
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
    $('#tricks-status').text(trickStatusText(totalBids - totalExtra - dealNumber));
}

function moveRequest(type, leader) {
    updateCurrentPlayer(mySeat);
    myTurn = true;
    phase = type;
    if (!focused)
        snd.play();
    if (type == 0) {
        $('#number-value').text(Math.round(dealNumber / playerCount));
        $('.number-spinner').show();
    }
    else if (type == 2) {
        $('.marriage-option-yes').remove();
        for (var i = leader.length - 1; i > 0; i--)
            $('.marriage-option-no').before('<div class="marriage-cloud marriage-option-yes" value="' + leader[i] + '">Zamelduj ' + leader[i] + '</div>');
        $('.marriage-option-yes').click(function(){
            moveSend(2, parseInt($(this).attr('value')));
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
        if (marriageMode) {
            $('.card.hovered').removeClass('hovered');
            marriageBack();
        }
        $('.card-clickable').removeClass('selected hovered');
        $(':hover').last().trigger('mouseleave');
        return;
    }
    myTurn = false;
    if (moveType == 0) {
        $('.number-spinner').hide();
        tricks[0].text(moveValue);
        declared[0] = moveValue;
        totalBids += moveValue;
        $('#declarations-total').text(totalBids + ' / ' + dealNumber);
    }
    else if (moveType == 2) {
        $('.marriage-window').hide();
    }
    else {
        if (moveMarriage) {
            trumpUpdate(moveMarriage[0].suit);
        }
        else {
            board[0].append($('div.selected'));
        }
        if (marriageMode) {
            marriageMode = false;
            $('.marriage-choose').hide();
        }
        $('.card.selected').addClass('board');
        $('.card.board').removeClass('selected hovered card-clickable');
    }
    $('.card.hovered').removeClass('hovered');
}

function moveReceive(player, type, value, marriage) {
    player = seat(player)
    if (type == 0) {
        tricks[player].text(value);
        declared[player] = value;
        totalBids += value;
        $('#declarations-total').text(totalBids + ' / ' + dealNumber);
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

function updatePlayerStatus(player, status) {
    player = seat(player);
    nicks[player].removeClass('connected inactive disconnected');
    nicks[player].addClass(status);
}

function clearBoard() {
    tricksDecrease($('#desk-south .card').length);
    $('.desk-last .desk-board').empty();
    $('#desk-east-last').append($('#desk-east').children());
    $('#desk-north-last').append($('#desk-north').children());
    $('#desk-west-last').append($('#desk-west').children());
    $('#desk-south-last').append($('#desk-south').children());

    $('.desk .desk-board').empty();
    $('.card.show').attr('class', 'card facedown');
}

function focusChat() {
    // hold chat input focus for non-mobile devices
    if (!mobile) {
        $('#chat-input').focus();
        $('#chat-input').blur(function(){
            setTimeout(function(){
                $('#chat-input').focus();
            }, 0);
        });
    }
}

function blurChat() {
    $('#chat-input').off('blur');
}

$(document).ready(function(){
    // card faces test
    
    /*for (var i = 0; i < 4; i++)
        for (var j = 2; j < 15; j++)
            $('#hand-south').append(create_card(new Card(i, j)));
    $('#button-south').hide();
    $('#hand-south').show();
    return;*/

    $('<img/>').attr('src', '/faces/sprite.png').on('load', (function(){
        $(this).remove();
    }));

    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        mobile = true;
    }
    
    $('body').css('background-image', 'url(wood.png)');

    socket = io('/table');

    focusChat();

    // $('#username').focus();

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
        if (seated) {
            updatePlayerStatus(mySeat, 'inactive');
            socket.emit('blur');
        }
    });

    $(window).focus(function(){
        focused = true;
        if (seated) {
            updatePlayerStatus(mySeat, 'connected');
            socket.emit('focus');
        }
    });

    $(window).resize(updateRowWidth);

    $('.marriage-cancel').click(marriageBack);

    $('.marriage-option-no').click(function(){
        moveSend(2, 0);
    });

    socket.on('updatePlayerStatus', updatePlayerStatus);

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

    socket.on('seatResponse', function(response, place, name){
        if (response) {
            seated = true;
            names[place] = name;
            mySeat = place;
            $('#username-request').hide();
            $('#stand-button').show();
            // $('#leave-button').hide();
            updateAllNames(names);
        }
        else {
            // do nothing?
        }
    });

    socket.on('updatePhase', updatePhase);
    socket.on('chatReceive', chatReceive);
    socket.on('handReceive', handReceive);
    socket.on('moveReceive', moveReceive);
    socket.on('moveRequest', moveRequest);
    socket.on('trumpReceive', trumpReceive);
    socket.on('optionsUpdate', updateGameOptions);
    socket.on('moveOK', moveOK);
    $('#stand-button').click(function(){
        $('#stand-button').hide();
        // $('#leave-button').show();
        socket.emit('stand');
        names[mySeat] = null;
        mySeat = 0;
        seated = false;
        updateAllNames(names);
    });

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

    $('#last-close').click(function(){
        $('.desk-last').hide();
    });

    $('#options-button').click(function(){
        blurChat();
        $('.options').show();
    });

    $('#options-close').click(function(){
        focusChat();
        $('.options').hide();
    });

    $('#options-marriages').change(function(){
        if (!$(this).prop('checked'))
            $('#options-half').prop('checked', false);
    });

    $('#options-half').change(function(){
        if ($(this).prop('checked'))
            $('#options-marriages').prop('checked', true);
    });

    $('#options-confirm').click(submitGameOptions);

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

    socket.emit('hello', $('#get-table').val(), $('#get-name').val());

});
