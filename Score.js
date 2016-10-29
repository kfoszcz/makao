function Score(single, type) {
	this.single = single;
	this.type = type;
	this.declared = 0;
	this.cumulated = 0;
}

Score.SUCCESS = 2;
Score.HANDICAP = 1;
Score.FAIL = 0;

module.exports = Score;
