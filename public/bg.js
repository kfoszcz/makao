$(document).ready(function(){
	$('<img/>').attr('src', '/wood.png').on('load', (function(){
	    $(this).remove();
	    $('body').css('background-image', 'url(/wood.png)');
	}));
});