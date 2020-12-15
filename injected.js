(function() {
	var secondaryLang = null;
	const FMT = "&fmt=json3";
	const AUTOMATIC_TRANS = '&kind=asr';
	let subsbtn = document.querySelector(".ytp-subtitles-button");
	areSubsOn = () => { subsbtn.getAttribute("aria-pressed") === 'true' }

	/*
	let ytplayer = (function(e) {
		let t;
		for (const n of e) {
			if (n.innerText.startsWith("var ytplayer = ytplayer")) {
				t = n.innerText;
				break
			}
		}
		const n = t.match(/"player_response":"({.+?})",/)[1].replace(/\\"/g, '"').replace(/\\\\"/g, '\\"');
		return JSON.parse(n);
	})(document.scripts);*/

	let captionsInfo = ytplayer.config.args.raw_player_response.captions.playerCaptionsTracklistRenderer;
	let cTracks = captionsInfo.captionTracks;
	let tlangs = captionsInfo.translationLanguages;

	function onSubChange(event) {
		secondaryLang = null;
		if (Number(document.getElementById('lang').value) === 0) {
			let g = () => subsbtn.click();
			setTimeout(g, 100), setTimeout(g, 200);
			return;
		}

		function send(url) {
			var xhr = new XMLHttpRequest();
			xhr.open("GET", url, true);

			xhr.onreadystatechange = function() {
				if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
					secondaryLang = JSON.parse(this.responseText);
					let g = () => subsbtn.click();
					setTimeout(g, 100), setTimeout(g, 200);
				}
			}
			xhr.send();
		}

		send(getBaseUrl() + FMT + getTLang());
	}

	function getBaseUrl() {
		let idx = Number(document.getElementById('lang').value) - 1;
		let langCode = cTracks[idx].languageCode;
		let baseUrl = cTracks[idx].baseUrl.replace(/\\u0026/g, '&');
		return baseUrl;
	}

	function getTLang() {
		let idx = Number(document.getElementById('tlang').value) - 1;
		if (idx === -1)
			return '';

		return "&tlang=" + tlangs[idx].languageCode;
	}

	function createLangSelection(langs) {
		let s = document.createElement('select');
		let i = 0;
		addOption(s, i++, 'Off');
		for (l of langs) {
			addOption(s, i++, l.name.simpleText);
		}
		s.addEventListener('change', onSubChange);
		return s;
	}

	function createTranslatedLangSelection(langs) {
		let s = document.createElement('select');
		let i = 0;
		addOption(s, i++, 'Off');
		for (l of langs) {
			addOption(s, i++, l.languageName.simpleText);
		}
		s.addEventListener('change', onSubChange);
		return s;
	}

	function addOption(s, value, text) {
		let o = document.createElement('option');
		o.value = value;
		o.innerText = text;
		s.appendChild(o);
	}

	let s = createLangSelection(cTracks);
	s.id = 'lang';
	let t = createTranslatedLangSelection(tlangs);
	t.id = 'tlang';

	let f = (function() {
		div = document.querySelector('div#info.style-scope.ytd-video-primary-info-renderer');
		if (div == undefined) {
			setTimeout(f, 1000);
			return;
		}
		div = div.children[1];
		div.appendChild(s);
		div.appendChild(t);
	});
	setTimeout(f, 1000);

	// { "iAttr": 1 }
	// "pPenId": 1
	// szPenSize (%)
	// medium.com/@js_jrod/the-first-complete-guide-to-youtube-captions-f886e06f7d9d
	function style(lang) {
		lang.wsWinStyles.forEach(xi => xi.juJustifCode = xi.juJustifCode === undefined? undefined : 2);
		lang.events.forEach(xi => xi.wWinId = undefined);
		// lang.wpWinPositions = [ {} ]
		if (!lang.pens)
			lang.pens = [ {}, {} ];
		else if (lang.pens.length < 2)
			lang.pens.push({})
		lang.pens[1]["szPenSize"] = 60;
		// lang.pens[1]["iAttr"] = 1;
	}

	// It uses the first event as a placeholder or to save
	// some information. It's annoying
	function weirdFirstEvent(event) {
		if (event.tStartMs !== 0)
			return false;

		// Los manuales generalmente tienen esto
		if (event.segs && event.segs.length === 1 && event.segs[0].utf8.trim() === '.')
			return true;

		// Los automaticos generalmente tienen esto
		if (event.id)
			return true;

		return false
	}

	// The primaryLang is modified
	// TODO I think this doesn't work on a secondary video coming on segments/events like the first one
	// BUG doesn't work if you combine manually and auto generated because they have different timestamp
	// can be done but would be really annoying changing at different times, unuseable
	function combineSubs(primaryLang, secondaryLang) {
		let primaryEv = primaryLang.events;
		let secondaryEv = secondaryLang.events;

		// console.log(JSON.stringify(primaryLang));
		// console.log(JSON.stringify(secondaryLang));

		// the event on 0 has weird info
		let i = weirdFirstEvent(primaryEv[0]) ? 1 : 0;
		let j = weirdFirstEvent(secondaryEv[0]) ? 1 : 0;
		for (; i < primaryEv.length && j < secondaryEv.length; i++, j++) {
			if (primaryEv[i].tStartMs !== secondaryEv[j].tStartMs)
				continue;

			// amount of events to combine
			let i_f = 1;
			if (j === secondaryEv.length - 1) {
				i_f = primaryEv.length - i;
			} else {
				while (i + i_f < primaryEv.length && primaryEv[i + i_f].tStartMs < secondaryEv[j + 1].tStartMs) {
					i_f++;
				}
			}

			// new duration
			// primaryEv[i].dDurationMs = primaryEv[i_f].tStartMs + primaryEv[i_f].dDurationMs - primaryEv[i].tStartMs;

			// removes eventos on the primary
			primaryEv[i].segs[0].utf8 = primaryEv.slice(i, i + i_f).flatMap(event => event.segs.map(x => x.utf8).join('')).join('').replace('\n', ' ').trim();
			primaryEv[i].segs.splice(1);
			primaryEv.splice(i+1, i_f-1);

			// add the second lang
			secondaryEv[j].segs[0].utf8 = secondaryEv[j].segs.map(x => x.utf8).join('').replace('\n', ' ').trim();
			secondaryEv[j].segs[0]["pPenId"] = 1;
			primaryEv[i].segs[0].utf8 += '\n';
			primaryEv[i].segs.splice(1, 0, secondaryEv[j].segs[0]);
		}
		// console.log(JSON.stringify(primaryLang));
	}

	// from stackoverflow.com/a/51594799
	var _open = XMLHttpRequest.prototype.open;
	window.XMLHttpRequest.prototype.open = function (method, URL) {
		var _onreadystatechange = this.onreadystatechange,
			_this = this;

		_this.onreadystatechange = function () {
			if (_this.readyState === 4 && _this.status === 200 && ~URL.indexOf('timedtext')) {
				try {
					//////////////////////////////////////
					// THIS IS ACTIONS FOR YOUR REQUEST //
					//////////////////////////////////////
					var data = JSON.parse(_this.responseText);
					if (secondaryLang) {
						combineSubs(data, secondaryLang);
						style(data);
					}
					// rewrite responseText
					Object.defineProperty(_this, 'responseText', {value: JSON.stringify(data)});
					Object.defineProperty(_this, 'response', {value: JSON.stringify(data)});
					/////////////// END //////////////////
				} catch (e) {
					console.error(e);
				}

			}
			// call original callback
			if (_onreadystatechange) _onreadystatechange.apply(this, arguments);
		};

		// detect any onreadystatechange changing
		Object.defineProperty(this, "onreadystatechange", {
			get: function () {
				return _onreadystatechange;
			},
			set: function (value) {
				_onreadystatechange = value;
			}
		});

		return _open.apply(_this, arguments);
	};
})()
